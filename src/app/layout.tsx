import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { FontPreload } from '@/components/font-preload';

export const metadata: Metadata = {
  title: {
    default: '工程报价及维保业务管理系统',
    template: '%s | 工程报价系统',
  },
  description: '宁德移动ICT项目工程报价及维保业务管理系统',
  keywords: ['工程报价', '维保报价', 'ICT项目', '宁德移动'],
  authors: [{ name: '宁德移动ICT项目组' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        <FontPreload />
        {isDev && <Inspector />}
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
