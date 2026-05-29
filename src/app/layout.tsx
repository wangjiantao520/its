import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { FontPreload } from '@/components/font-preload';
import { UserProvider } from '@/contexts/user-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { AuthProtected } from '@/components/auth-protected';

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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased bg-background text-foreground`}>
        <FontPreload />
        {isDev && <Inspector />}
        <ThemeProvider>
          <UserProvider>
            <AuthProtected>
              <AppLayout>{children}</AppLayout>
            </AuthProtected>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}