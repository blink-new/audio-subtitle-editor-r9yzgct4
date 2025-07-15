import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

// Enhanced MetaMask error detection
const isMetaMaskError = (error: Error): boolean => {
  if (!error) return false
  
  const errorMessage = error.message || error.stack || String(error)
  const metamaskKeywords = [
    'metamask',
    'MetaMask',
    'metamask_getProviderState',
    'ethereum.request',
    'ethereum.send',
    'web3',
    'provider',
    'requestProvider.js',
    'inpage.js'
  ]
  
  return metamaskKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  )
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Filter out MetaMask-related errors
    if (isMetaMaskError(error)) {
      console.warn('MetaMask-related error detected in ErrorBoundary (non-critical):', error.message)
      return { hasError: false } // Don't show error UI for MetaMask errors
    }
    
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Filter out MetaMask-related errors as they don't affect our app
    if (isMetaMaskError(error)) {
      console.warn('MetaMask-related error caught in ErrorBoundary (non-critical):', error.message)
      // Reset the error boundary for MetaMask errors
      this.setState({ hasError: false, error: undefined })
      return
    }

    console.error('Uncaught error in ErrorBoundary:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError && this.state.error) {
      // Double-check: Don't show error UI for MetaMask-related errors
      if (isMetaMaskError(this.state.error)) {
        return this.props.children
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              <div className="flex gap-2">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}