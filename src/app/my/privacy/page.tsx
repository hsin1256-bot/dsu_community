import React from 'react';
import Header from '@/components/Header';
import PolicyDocument, { PolicySection } from '@/components/my/PolicyDocument';
import { APP_NAME } from '@/lib/app-info';

const sections: PolicySection[] = [
  {
    title: '수집하는 개인정보',
    body: [
      '현재 앱은 회원가입 없이 이용할 수 있으며, 아래 경우에만 정보를 받습니다.',
      [
        '문의 및 피드백: 문의 내용, 답변받을 이메일(선택), 문의를 보낸 화면 경로, 앱 버전',
        '학식 리뷰: 닉네임, 별점, 리뷰 내용, 사진(선택)',
        '서비스 이용 과정에서 호스팅 업체 서버에 접속 기록(IP 주소, 접속 시각 등)이 자동으로 남을 수 있습니다.',
      ],
      '보관함, 알림 설정, 키워드, 개인 일정은 이용자의 기기(브라우저)에만 저장되며 운영팀 서버로 전송되지 않습니다.',
      '[로그인 기능 도입 시 추가] 학교 이메일 주소, 닉네임',
    ],
  },
  {
    title: '이용 목적',
    body: [['문의 답변 및 서비스 개선', '학식 리뷰 표시 및 부적절한 게시물 관리', '부정 이용 방지']],
  },
  {
    title: '보관 기간',
    body: [
      ['문의 및 피드백: [예: 처리 완료 후 1년] 보관 후 삭제', '학식 리뷰: 이용자가 삭제하거나 서비스가 종료될 때까지', '[로그인 도입 시] 계정 정보: 회원 탈퇴 시 즉시 삭제'],
    ],
  },
  {
    title: '처리 위탁',
    body: [
      '서비스 운영을 위해 아래 업체의 서비스를 이용합니다.',
      [
        'Supabase Inc. — 데이터베이스·파일 저장 (서버 위치: 대한민국 서울 리전)',
        'Vercel Inc. — 웹 호스팅 [배포 시 확정]',
        'Google LLC (Gemini API) — 학교 공지 원문 요약. 이용자의 개인정보는 전송하지 않습니다.',
      ],
    ],
  },
  { title: '제3자 제공', body: ['법령에 따른 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.'] },
  {
    title: '이용자의 권리',
    body: ['이용자는 자신의 리뷰·문의 정보의 열람, 수정, 삭제를 요청할 수 있습니다. 마이 > 문의 및 피드백 또는 아래 연락처로 요청해 주세요.'],
  },
  { title: '개인정보 보호책임자', body: [['이름: [담당자 이름]', '연락처: [운영팀 이메일]']] },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="개인정보처리방침" />
      <PolicyDocument
        updatedAt="[YYYY-MM-DD]"
        intro={`${APP_NAME} 운영팀은 이용자의 개인정보를 중요하게 생각하며, 개인정보 보호법에 따라 아래와 같이 처리합니다.`}
        sections={sections}
      />
    </main>
  );
}
