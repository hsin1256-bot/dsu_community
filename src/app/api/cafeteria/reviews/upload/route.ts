import { NextRequest, NextResponse } from 'next/server';
import { uploadReviewPhoto } from '@/lib/db/cafeteria';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/**
 * 파일 앞부분(매직 바이트)으로 실제 이미지 형식 판별.
 * 브라우저가 보낸 Content-Type 은 조작할 수 있으므로 믿지 않습니다. (SVG/HTML 업로드 차단)
 */
function detectImageMime(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

// 서버 API 라우트 전용 리뷰 사진 업로드 (Supabase Storage 'review-photos' 버킷)
export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_FILE_SIZE_BYTES + 64 * 1024) {
      return NextResponse.json({ success: false, error: '이미지 용량은 최대 5MB 이하만 업로드할 수 있습니다.' }, { status: 413 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: '업로드할 이미지 파일이 필요합니다.' }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: '이미지 용량은 최대 5MB 이하만 업로드할 수 있습니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(buffer);
    if (!mime) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP, GIF만 업로드 가능)' },
        { status: 400 }
      );
    }

    const publicUrl = await uploadReviewPhoto(buffer, mime);
    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('[review photo upload]', error);
    return NextResponse.json({ success: false, error: '이미지 업로드 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
