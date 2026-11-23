import { NextRequest, NextResponse } from 'next/server';
import { uploadReviewPhoto } from '@/lib/supabase';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// 서버 API 라우트 전용 리뷰 사진 업로드 (Supabase Storage 'review-photos' 버킷)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: '업로드할 이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: '지원하지 않는 이미지 형식입니다. (JPG, PNG, WEBP, GIF만 업로드 가능)',
        },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: '이미지 용량은 최대 5MB 이하만 업로드할 수 있습니다.',
        },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization');
    const accessToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadReviewPhoto(buffer, file.type, file.name, accessToken);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
