import { createFileRoute } from '@tanstack/react-router';
import { AuthPage } from '@/components/app/AuthPage';
export const Route=createFileRoute('/signup-user')({component:()=> <AuthPage mode="user"/>});
