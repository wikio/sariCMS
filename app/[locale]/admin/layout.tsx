import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import AdminLayout from '@/components/admin/AdminLayout';

const inter = Inter({ subsets: ['latin'], variable: '--font-admin-latin', display: 'swap' });
const noto = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-admin-arabic', display: 'swap' });

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${noto.variable}`}>
      <AdminLayout>{children}</AdminLayout>
    </div>
  );
}