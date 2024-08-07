import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import sharp from "sharp";

// 환경 변수
const RESIZE_WIDTH = process.env.RESIZE_WIDTH || 600; // 리사이즈 할 이미지 width
const REGION = process.env.REGION || "ap-northeast-2"; // 서울 리전 예시, 실제 리전에 맞게 수정

const client = new S3Client({ region: REGION });

export const handler = async (event, context) => {
  // event는 S3의 이벤트로 주어집니다 https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/with-s3.html
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));

  const srcBucket = event.Records[0].s3.bucket.name; // event에서 버킷 이름을 가져옵니다
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " ")); // 파일 이름에서 공백이나 유니코드 문자를 제거

  const dstBucket = srcBucket; // 리사이즈된 이미지도 같은 버킷에 저장할 때
  const dstKey = getDstKey(srcKey); // 리사이즈된 이미지 파일 이름(getDstKey 함수를 커스텀하세요)

  try {
    checkKeyType(srcKey);
    const image = await downloadFromS3(srcBucket, srcKey);
    var resizedImage = await resizeImage(image, RESIZE_WIDTH);
    await uploadToS3(resizedImage, dstBucket, dstKey);
    console.log(`${srcBucket}/${srcKey} 가 성공적으로 리사이즈 되어\n${dstBucket}/${dstKey} 에 업로드 되었습니다`);
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};

const getDstKey = (srcKey) => {
  // 원하는 방식으로 자유롭게 파일 이름을 변환하세요!

  // 예시1: /origin/image.jpg -> /resize/image.webp
  // return srcKey.replace("origin", "resize").replace(/\.\w+$/, ".webp");

  // 예시2: /food_images/image.jpg -> /resize/food_images/image.webp
  // return srcKey
  // .replace(/^\//, "/resize/") // 시작 부분에 '/resize/' 추가
  // .replace(/\.\w+$/, ".webp"); // 확장자를 .webp로 변경

  // 예시3: /food_images/image.jpg -> /food_images/image.webp (원본 파일 이름 유지, 버킷 변경 권장)
  return srcKey.replace(/\.\w+$/, ".webp");
};

const checkKeyType = (key) => {
  const typeMatch = key.match(/\.([^.]*)$/);
  if (!typeMatch) {
    throw new Error("이미지 확장자를 찾을 수 없습니다");
  }

  // 이미지 타입 체크 https://sharp.pixelplumbing.com
  const imageType = typeMatch[1].toLowerCase();
  const VALID_IMAGE_TYPES = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
  if (VALID_IMAGE_TYPES.indexOf(imageType) === -1) {
    throw new Error(`지원하지 않는 이미지 타입: ${imageType}`);
  }
  console.log(`이미지 타입: ${imageType}에 이상이 없습니다`);
};

const resizeImage = async (image, width) => {
  console.log("이미지 리사이즈 완료");
  return await sharp(image).resize(width).webp().toBuffer();
};

const downloadFromS3 = async (bucket, key) => {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const stream = response.Body;

  if (stream instanceof Readable) {
    console.log("S3에서 이미지 다운로드 완료");
    return Buffer.concat(await stream.toArray());
  } else {
    throw new Error("Unknown object stream type");
  }
};

const uploadToS3 = async (image, bucket, key) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: image,
    ContentType: "image/webp",
  };

  await client.send(new PutObjectCommand(params));
  console.log("S3에 이미지 업로드 완료");
};
