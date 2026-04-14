import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      signUpUrl="/sign-up"
      signUpFallbackRedirectUrl="/"
      signInFallbackRedirectUrl="/"
      appearance={{
        layout: {
          logoImageUrl: 'https://chat.myrecruiter.ai/collateral/MyRecruiterLogo-hires.png',
          socialButtonsVariant: 'blockButton',
        },
        variables: {
          colorPrimary: '#50C878',
          colorTextOnPrimaryBackground: '#ffffff',
          colorBackground: '#ffffff',
          colorText: '#1e293b',
          colorTextSecondary: '#64748b',
          borderRadius: '0.5rem',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        },
        elements: {
          card: 'shadow-xl border border-slate-100',
          formButtonPrimary: 'bg-[#50C878] hover:bg-[#059669] transition-colors',
          footerActionLink: 'text-[#50C878] hover:text-[#059669]',
          socialButtonsBlockButton: 'border-slate-200 hover:bg-slate-50',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
