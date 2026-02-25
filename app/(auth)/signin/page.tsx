'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/providers/auth-provider';
import { getOfficesApi, type OfficeItem } from '@/lib/api';

const signinSchema = z.object({
  office_id: z.string().min(1, { message: 'Kantor wajib dipilih.' }),
  email: z
    .string()
    .min(1, { message: 'Email wajib diisi.' })
    .email({ message: 'Masukkan alamat email yang valid.' }),
  password: z.string().min(1, { message: 'Password wajib diisi.' }),
});

type SigninFormValues = z.infer<typeof signinSchema>;

export default function SignInPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [offices, setOffices] = useState<OfficeItem[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SigninFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      office_id: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    getOfficesApi()
      .then(setOffices)
      .catch(() => setOffices([]))
      .finally(() => setOfficesLoading(false));
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  async function onSubmit(values: SigninFormValues) {
    setIsProcessing(true);
    setError(null);
    try {
      await login(values.office_id, values.email, values.password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Silakan coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  }

  if (isAuthenticated) return null;

  if (isLoading) {
    return (
      <Card className="w-full max-w-[400px]">
        <CardContent className="p-6 flex items-center justify-center min-h-[200px]">
          <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[400px]">
      <CardContent className="p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="block w-full space-y-5"
          >
            <div className="space-y-1.5 pb-3">
              <h1 className="text-2xl font-semibold tracking-tight text-center">
                Masuk ke eNotaris
              </h1>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertIcon>
                  <AlertCircle />
                </AlertIcon>
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="office_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kantor</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={officesLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={officesLoading ? 'Memuat...' : 'Pilih kantor'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {offices.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@contoh.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        placeholder="Password"
                        type={passwordVisible ? 'text' : 'password'}
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute end-0 top-1/2 -translate-y-1/2 h-7 w-7 me-1.5"
                      aria-label={passwordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
                      onClick={() => setPasswordVisible(!passwordVisible)}
                    >
                      {passwordVisible ? (
                        <EyeOff className="text-muted-foreground size-4" />
                      ) : (
                        <Eye className="text-muted-foreground size-4" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2.5">
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                Masuk
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
