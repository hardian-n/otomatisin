'use client';

import { useForm, SubmitHandler, FormProvider } from 'react-hook-form';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import Link from 'next/link';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { useMemo, useState } from 'react';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { LoginUserDto } from '@gitroom/nestjs-libraries/dtos/auth/login.user.dto';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
type Inputs = {
  email: string;
  password: string;
  providerToken: '';
  provider: 'LOCAL';
};
export function Login() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const resolver = useMemo(() => {
    return classValidatorResolver(LoginUserDto);
  }, []);
  const form = useForm<Inputs>({
    resolver,
    defaultValues: {
      providerToken: '',
      provider: 'LOCAL',
    },
  });
  const fetchData = useFetch();
  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setLoading(true);
    const login = await fetchData('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        provider: 'LOCAL',
      }),
    });
    if (login.status === 400) {
      form.setError('email', {
        message: await login.text(),
      });
      setLoading(false);
    }
  };
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <h1 className="text-3xl font-bold text-start mb-4 cursor-pointer">
            {t('sign_in', 'Sign In')}
          </h1>
        </div>
        <div className="text-textColor">
          <Input
            label="Email"
            translationKey="label_email"
            {...form.register('email')}
            type="email"
            placeholder="Email Address"
          />
          <Input
            label="Password"
            translationKey="label_password"
            {...form.register('password')}
            autoComplete="off"
            type="password"
            placeholder="Password"
          />
        </div>
        <div className="text-center mt-6">
          <div className="w-full flex">
            <Button
              type="submit"
              className="flex-1 rounded-[4px]"
              loading={loading}
            >
              {t('sign_in_1', 'Sign in')}
            </Button>
          </div>
          <p className="mt-4 text-sm">
            {t('don_t_have_an_account', "Don't Have An Account?")}&nbsp;
            <Link href="/auth" className="underline cursor-pointer">
              {t('sign_up', 'Sign Up')}
            </Link>
          </p>
          <p className="mt-4 text-sm text-red-600">
            <Link href="/auth/forgot" className="underline cursor-pointer">
              {t('forgot_password', 'Forgot password')}
            </Link>
          </p>
        </div>
      </form>
    </FormProvider>
  );
}
