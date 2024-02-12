import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import sharp from "sharp";
import util from "util";

const s3 = new S3Client({ region: "{지역코드 ex:ap-northeast-2}" });

export const handler = async (event, context) => {
  // event에서 버킷 이름 가져오기
  console.log("Reading options from event:\n", util.inspect(event, { depth: 5 }));
  const srcBucket = event.Records[0].s3.bucket.name;

  // 파일 이름에서 공백이나 유니코드 문자를 제거
  const srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const dstBucket = srcBucket; // 리사이즈된 이미지도 같은 버킷에 저장될 때
  const dstKey = srcKey.replace("original", "resize").replace(/\.\w+$/, ".webp"); // 디렉토리와 파일 확장자 변환

  const typeMatch = srcKey.match(/\.([^.]*)$/);
  if (!typeMatch) {
    console.log("Could not determine the image type.");
    return;
  }

  // Supported image types for Sharp
  const imageType = typeMatch[1].toLowerCase();
  if (imageType != "jpg" && imageType != "png") {
    console.log(`Unsupported image type: ${imageType}`);
    return;
  }

  try {
    const params = {
      Bucket: srcBucket,
      Key: srcKey,
    };
    var response = await s3.send(new GetObjectCommand(params));
    var stream = response.Body;

    if (stream instanceof Readable) {
      var content_buffer = Buffer.concat(await stream.toArray());
    } else {
      throw new Error("Unknown object stream type");
    }
  } catch (error) {
    console.log(error);
    return;
  }

  const width = 600; // 리사이즈 할 이미지 width

  try {
    var output_buffer = await sharp(content_buffer)
      .resize(width)
      .webp() // Convert to webp
      .toBuffer();
  } catch (error) {
    console.log(error);
    return;
  }

  try {
    const destparams = {
      Bucket: dstBucket,
      Key: dstKey,
      Body: output_buffer,
      ContentType: "image/webp",
    };

    await s3.send(new PutObjectCommand(destparams));
  } catch (error) {
    console.log(error);
    return;
  }

  console.log("Successfully resized " + srcBucket + "/" + srcKey + " and uploaded to " + dstBucket + "/" + dstKey);
};
