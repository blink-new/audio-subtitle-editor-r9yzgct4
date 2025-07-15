import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Comprehensive MetaMask error suppression
const isMetaMaskError = (error: any): boolean => {
  if (!error) return false
  
  const errorMessage = error.message || error.reason?.message || String(error)
  const metamaskKeywords = [
    'metamask',
    'MetaMask',
    'metamask_getProviderState',
    'ethereum.request',
    'ethereum.send',
    'web3',
    'provider'
  ]
  
  return metamaskKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  )
}

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  if (isMetaMaskError(event.error)) {
    console.warn('MetaMask-related error suppressed (non-critical):', event.error?.message || event.error)
    event.preventDefault()
    return false
  }
})

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (isMetaMaskError(event.reason)) {
    console.warn('MetaMask-related promise rejection suppressed (non-critical):', event.reason?.message || event.reason)
    event.preventDefault()
    return false
  }
})

// Override console.error to filter MetaMask errors
const originalConsoleError = console.error
console.error = (...args: any[]) => {
  const errorString = args.join(' ')
  if (isMetaMaskError({ message: errorString })) {
    console.warn('MetaMask console error suppressed:', ...args)
    return
  }
  originalConsoleError.apply(console, args)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Toaster position="top-right" />
    <App />
  </React.StrictMode>,
)