import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/components/ui/status-screen';

export default function NotFound() {
  return (
    <StatusScreen
      icon={<FileQuestion />}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
    >
      <Button asChild>
        <Link href="/">Go to my workspace</Link>
      </Button>
    </StatusScreen>
  );
}
