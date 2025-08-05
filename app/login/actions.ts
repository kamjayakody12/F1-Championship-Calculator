'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-cast since the values are guaranteed to be strings
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?message=Could not authenticate user')
  }

  // Get redirect parameter from form data
  const redirectTo = formData.get('redirect') as string || '/admin'

  redirect(redirectTo)
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-cast since the values are guaranteed to be strings
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string

  // Validate password confirmation
  if (password !== confirmPassword) {
    redirect('/signup?message=Passwords do not match')
  }

  // Validate password strength
  if (password.length < 6) {
    redirect('/signup?message=Password must be at least 6 characters')
  }

  const { data: { user }, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
      }
    }
  })

  if (error) {
    redirect('/signup?message=Could not create account')
  }

  // Always redirect to signup page with email confirmation message
  // This ensures users see the confirmation message even if they need to verify their email
  const redirectUrl = `/signup?message=Please check your email for a confirmation link to complete your account setup&email=${encodeURIComponent(email)}`
  redirect(redirectUrl)
} 