import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/app/AuthPage';
export const Route=createFileRoute('/login')({component:()=> <AuthPage mode="login"/>});
