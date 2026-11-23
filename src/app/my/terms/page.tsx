import React from 'react';
import Header from '@/components/Header';
import PolicyDocument, { PolicySection } from '@/components/my/PolicyDocument';
import { APP_NAME } from '@/lib/app-info';

const sections: PolicySection[] = [
  { title: '목적', body: [`이 약관은 ${APP_NAME}(이하 "앱")을 이용하는 데 필요한 기본 사항을 정합니다.`] },
  {
    title: '앱의 성격',
    body: [
      '앱은 동서대학교 학생이 만든 비공식 서비스이며, 동서대학교가 운영하거나 보증하지 않습니다.',
      '공지사항·학사일정·식단은 학교 홈페이지 등 공개된 정보를 가져와 보여주며, 실제 내용과 다르거나 늦게 반영될 수 있습니다. AI 요약은 틀릴 수 있으므로 중요한 내용은 반드시 원문을 확인해야 합니다.',
    ],
  },
  {
    title: '이용자의 의무',
    body: [
      '이용자는 다음 행위를 해서는 안 됩니다.',
      ['타인을 비방하거나 개인정보를 노출하는 리뷰·문의 작성', '광고·도배 등 서비스 운영을 방해하는 행위', '자동화 도구로 서비스에 과도한 요청을 보내는 행위', '타인을 사칭하는 행위'],
    ],
  },
  {
    title: '게시물 관리',
    body: ['운영팀은 위 의무를 어긴 리뷰 등 게시물을 사전 통보 없이 숨기거나 삭제할 수 있습니다. 이용자는 신고 기능으로 부적절한 게시물을 알릴 수 있습니다.'],
  },
  {
    title: '책임의 제한',
    body: ['앱에 표시된 정보의 오류·지연으로 생긴 손해(예: 신청 기한을 놓친 경우)에 대해 운영팀은 고의 또는 중대한 과실이 없는 한 책임지지 않습니다.'],
  },
  { title: '약관의 변경', body: ['약관을 바꾸는 경우 시행 7일 전부터 앱 안에 알립니다.'] },
  { title: '문의', body: ['마이 > 문의 및 피드백, 또는 [운영팀 이메일]로 문의할 수 있습니다.'] },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <Header showBack title="이용약관" />
      <PolicyDocument updatedAt="[YYYY-MM-DD]" intro={`${APP_NAME} 이용약관입니다.`} sections={sections} />
    </main>
  );
}
