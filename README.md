# s3-lambda-resize
S3와 Lambda(람다)를 이용한 이미지 자동 리사이즈 코드.

[AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)를 사용합니다.

# 과정
## 1. 버킷 생성
s3 업로드시 자동 이미지 리사이징을 위해 s3 버킷이 필요합니다.

이때, 람다가 무한반복하는 오류를 방지하기 위해서 기존 이미지 버킷과 리사이즈 이미지 버킷을 따로 두는 것이 좋으나, 단지 버킷 내에서 디렉토리를 구분하는 것으로도 분리할 수 있습니다.

## 2. 람다 함수 생성
이미지 리사이즈를 진행할 람다 함수를 생성합니다. 이때 runtime은 어느것으로도 할 수 있으나, 해당 코드는 Javascript(Node.js 런타임)로 작성되었습니다.

Lambda -> 함수(Functions) -> 함수 생성(Create function)
- 함수 이름(Function name): 원하는 이름
- 런타임(Runtime): Node.js 20.x
- 아키텍처(Architecture): x86_64

> 이때 람다 생성시 권한(Permissions)의 실행 역할(Execution role)에서 기본 Lambda 권한을 가진 새 역할 생성(Create a new role with basic Lambda permissions)을 선택해야 자동으로 CloudWatch Logs에 접근할 수 있는 권한이 부여됩니다. 이는 람다 작동시 필수권한임으로 선택해두는 것을 권장합니다.

## 3. IAM 정책 추가
AWS에서는 IAM을 이용하여 권한을 관리합니다. 이를 위해 람다에게 권한을 부여하기 위해 정책(policy)를 추가해줍니다.

IAM -> 정책(Policies) -> 정책 생성(Create policy) -> JSON

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::{버킷의 이름}/*"
        }
    ]
}
```
람다 생성시에 CloudWatch Logs 권한을 자동생성하지 않았다면, 아래의 권한도 Statement에 추가해줍니다.
```json
        {
            "Effect": "Allow",
            "Action": [
                "logs:PutLogEvents",
                "logs:CreateLogGroup",
                "logs:CreateLogStream"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
```

Resource에 전체 권한을 넣는것이 아닌 아래와 같이 특정 리소스에 대한 권한을 부여하는 것이 좋습니다.
```
arn:aws:logs:{지역}:{계정번호}:log-group:/aws/lambda/{function 명}:*

// 예시
arn:aws:logs:ap-northeast-1:123456789101:log-group:/aws/lambda/resizeImage:*
```

이후 <다음(Next)> 버튼을 누른 후
- 정책 이름(Policy name): {버킷이름}BucketReadWriteAccess 또는 원하는 이름

이후 <정책 생성(Create policy)>을 눌러 정책을 생성합니다.

## 4. IAM 역할 연결
IAM에 정책을 만들었다면 역할(role)에 정책을 연결해 줘야 합니다.
람다 생성시 자동 생성된 역할에 추가로 정책을 연결하거나, 새로운 역할을 만들어 연결하도록 합시다.

생성했던 람다 함수로 가서
- 구성(Configuration) -> 권한(Permissions) -> 역할 이름(Role name)

에서 람다에 연결된 역할을 확인합니다. 이후 클릭하여 해당 역할로 이동해

권한 추가(Add permissions) -> 정책 연결(Attach policies) -> 위에서 만든 정책을 선택 -> 권한 추가(Add permissions)

## 5. 트리거 설정
버킷에 이미지가 업로드 되었을때 리사이징을 진행할 것이니, 트리거에 해당 조건을 추가 해 줍니다.

트리거 추가(Add trigger) -> 소스 선택(Select a source) -> S3
- 버킷(Bucket): 리사이즈할 이미지가 있는 버킷 선택
- Event type(PUT, POST) -> prefix 설정(특정 폴더 지정시)

!!!주의!!! 이때 오리지널 이미지과 리사이즈된 이미지를 저장할 버킷을 따로 설정하지 않는다면 prefix 설정을 필수로 해주는 것이 좋습니다. 그렇지 않으면 람다 무한 재귀로 과도한 비용이 발생할 수 있습니다.

이후 <추가(Add)>를 눌러 트리거를 생성합니다.

## 6. 코드 등록
생성한 람다 -> 코드(Code)

에 index.mjs 코드를 람다 함수에 추가해줍니다.

이때 예시 코드를 사용한다면, 적절히 RESIZE_WIDTH, REGION, dstBucket, getDstKey 등을 커스텀 해서 사용하는 것을 권장합니다.

해당 코드는 업로드된 이미지를 600px width로리사이즈하고 확장자를 webp로 변환한 뒤 같은 위치에 다시 업로드하게 설정되어 있습니다. dstBucket을 수정하거나 코드를 적절히 수정하여 사용하세요.

## 7. 레이어 생성을 위한 파일 압축
이때 코드는 [sharp](https://www.npmjs.com/package/sharp) 패키지를 기반으로 동작하는데, 패키지 설치 없이 코드만으로는 동작이 어렵습니다. 이때 모듈들을 업로드 해주는것이 레이어 추가입니다.

따로 레이어를 추가하지 않고, 코드와 함꼐 압축해서 모두 업로드할 수 있으나, 모듈을 이용하면 이후에 재활용성이 높습니다.

### sharp 패키지 설치
> npm install --os=linux --cpu=linux --cpu=x64 sharp

### 패키지 압축
node_modules, package.json, package-lock.json 만을 포함한 파일들을 zip으로 압축합니다.
```
zip -r sharp-layer.zip .
```
> 이때 압축시에 최상위 디렉토리(폴더)를 포함하는 것이 아닌 그 안의 파일들만 압축해야 합니다. 이를 확인하려면 압축 파일의 이름을 변경하고 압축을 풀었을 때 생긴 폴더의 이름이 변경한 압축파일의 이름과 같은 것으로 확인할 수 있습니다.

### 기존 파일 이용
또는 해당 레포지토리의 sharp-layer.zip을 이용해도 됩니다.

## 8. 계층(Layer) 생성
람다 -> 계층(Layers) -> 계층 생성(Create layer)
- 이름(Name): sharpLayer(또는 원하는 이름)
- 업로드(Upload): .zip 파일 업로드(Upload a .zip file) -> sharp 패키지 압축 파일를 업로드합니다
- 호환 아키텍처(Compatible architectures): x86_64
- 호환 런타임(Compatible runtimes): Node.js 20.x

이후 <생성(Create)>을 눌러 계층을 생성합니다.

## 9. 람다에 계층 추가
생성한 람다 -> 코드(Code) -> 계층(Layers) -> [Add a layer]

사용자 지정 계층(Custom layers) -> 생성했던 계층 선택 -> 버전(Version) 선택 -> 추가(Add)