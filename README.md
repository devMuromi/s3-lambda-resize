# s3-lambda-resize
s3 업로드시 lambda(람다)를 통한 이미지 자동 리사이즈 예시 코드입니다.

# 필요 과정
## 1. 버킷 생성
s3 업로드시 자동 이미지 리사이징을 위해 s3 버킷이 필요합니다.
이때, 람다가 무한반복하는 오류를 방지하기 위해서 기존 이미지 버킷과 리사이즈 이미지 버킷을 따로 두는 것이 좋으나, 단지 버킷 내에서 디렉토리를 구분하는 것으로도 분리할 수 있습니다.

## 2. 람다 생성
이미지 리사이즈를 진행할 람다를 생성합니다. 이때 runtime은 어느것으로도 할 수 있으나, 해당 레포지토리의 코드는 Javascript(Node.js 런타임)로 작성되었습니다.
> 이때 람다 생성시 Permissions의 Execution role에서 Create a new role with basic Lambda permissions를 선택해야 자동으로 CloudWatch Logs에 접근할 수 있는 권한이 부여됩니다. 이는 람다 작동시 필수권한임으로 선택해두는 것을 권장합니다.

## 3. IAM 정책 추가
AWS에서는 IAM을 이용하여 권한을 관리합니다. 이를 위해 람다에게 권한을 부여하기 위해 정책(policy)를 추가해줍니다.
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::{버킷의 이름}/*"
        }
    ]
}
```
CloudWatch Logs권한을 자동생성하지 않았다면, 아래의 권한도 Statement에 추가해줍니다.
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
Resource에 전체 권한을 넣는것이 아닌 아래와 같이 설정해주어도 됩니다.
<pre><code>arn:aws:logs:{지역}:{계정번호}:log-group:/aws/lambda/{function 명}:*</code></pre>
예시:
<pre><code>arn:aws:logs:ap-northeast-1:123456789101:log-group:/aws/lambda/resizeImage:*</code></pre>

## 4. IAM 역할 연결
IAM에 정책을 만들었다면 역할(role)에 정책을 연결해 줘야 합니다.
람다 생성시 자동 생성된 역할에 추가로 정책을 연결을 하거나, 새로운 역할을 만들어 연결하도록 합시다.

역할은 > Edit basic settings 에서 변경 가능한데, 이때 역할 뿐만 아니라 함수의 메모리 할당, 타임아웃 설정도 널널하게 변경해주는 것이 좋습니다.

## 5. 트리거 설정
버킷에 이미지가 업로드 되었을때 리사이징을 진행할 것이니, 트리거에 해당 조건을 추가 해 줍니다.

S3 -> 버킷 지정 -> Event type(PUT, POST) -> prefix 설정(특정 폴더 지정시)

이때 오리지널 이미지과 리사이즈된 이미지를 저장할 버킷을 따로 설정하지 않는다면 prefix 설정을 필수로 해주는 것이 좋습니다. 그렇지 않으면 람다 무한 실행이 발생할 수 있습니다.
> PUT: , POST: 

## 6. 코드 등록
index.mjs 코드를 람다 함수에 작성해줍니다.

해당 코드는 original/ 디렉토리에 업로드된 이미지를 그대로 resize/ 디렉토리에 리사이즈 합니다. 이때 리사이즈 width는 600px, 포맷은 webp로 변환합니다.

## 7. 레이어 추가
이때 코드는 sharp 패키지를 기반으로 동작하는데, 패키지 설치 없이 코드만으로는 동작이 어렵습니다. 이때 모듈들을 업로드 해주는것이 레이어 추가입니다.

따로 레이어를 추가하지 않고, 코드와 함꼐 압축해서 모두 업로드할 수 있으나, 모듈을 이용하면 이후에 재활용성이 높습니다.
### sharp 패키지 설치
> npm install sharp

이때, macOS등의 환경이면
> npm install --os=linux --cpu=linux --cpu=x64 sharp
### 패키지 압축
index.mjs를 제외한 node_modules를 포함한 파일들을 zip으로 압축합니다.
> zip -r s3-lambda-resize s3-lambda-resize


### 레이어 생성
### 레이어 계층 등록

## 8. 