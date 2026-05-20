import { useState, useEffect } from 'react';
import { useLocalStorage as useKV } from '@/hooks/use-local-storage';
import { setApiKey } from '@/lib/api';
import { clearCache } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Key, CheckCircle, WarningCircle as AlertCircle, Info, ArrowClockwise as RefreshCw } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface ApiConfigProps {
  onConfigured?: () => void;
}

export function ApiConfig({ onConfigured }: ApiConfigProps) {
  const [apiKey, setApiKeyState] = useKV<string>('cfb-api-key', '');
  const [inputKey, setInputKey] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');

  useEffect(() => {
    if (apiKey) {
      setApiKey(apiKey);
      setInputKey(apiKey);
      testApiKey(apiKey);
    }
  }, [apiKey]);

  const testApiKey = async (key: string) => {
    if (!key.trim()) {
      setKeyStatus('unknown');
      return;
    }

    setIsTestingKey(true);
    try {
      setApiKey(key);
      
      // Test the API key by making a simple request
      const response = await fetch('https://api.collegefootballdata.com/teams', {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setKeyStatus('valid');
        toast.success('API key is valid!');
      } else {
        setKeyStatus('invalid');
        toast.error('API key is invalid or expired');
      }
    } catch (error) {
      console.error('API key test failed:', error);
      setKeyStatus('invalid');
      toast.error('Failed to test API key');
    }
    setIsTestingKey(false);
  };

  const handleSaveKey = async () => {
    const trimmedKey = inputKey.trim();
    if (!trimmedKey) {
      toast.error('Please enter an API key');
      return;
    }

    setApiKeyState(trimmedKey);
    await testApiKey(trimmedKey);
    
    if (keyStatus === 'valid') {
      // Clear cache to force refresh with new data
      clearCache();
      onConfigured?.();
    }
  };

  const handleRefreshData = () => {
    clearCache();
    toast.success('Data cache cleared. Players will be refreshed on next load.');
  };

  const getStatusBadge = () => {
    switch (keyStatus) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle size={14} className="mr-1" />
            Valid
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <AlertCircle size={14} className="mr-1" />
            Invalid
          </Badge>
        );
      case 'unknown':
        return (
          <Badge variant="outline">
            <Key size={14} className="mr-1" />
            Not tested
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key size={20} />
          College Football Data API Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info size={16} />
          <AlertDescription>
            To use live player data, you can optionally provide an API key from{' '}
            <a 
              href="https://collegefootballdata.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              collegefootballdata.com
            </a>
            . Without an API key, sample data will be used.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your College Football Data API key"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
            />
            <Button 
              onClick={handleSaveKey}
              disabled={isTestingKey}
              className="shrink-0"
            >
              {isTestingKey ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {getStatusBadge()}
          </div>
          
          {keyStatus === 'valid' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              className="flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Refresh Data
            </Button>
          )}
        </div>

        {keyStatus === 'invalid' && (
          <Alert variant="destructive">
            <AlertCircle size={16} />
            <AlertDescription>
              The API key appears to be invalid. Please check that you have:
              <ul className="mt-2 ml-4 list-disc text-sm">
                <li>Copied the key correctly from collegefootballdata.com</li>
                <li>An active account with API access</li>
                <li>Not exceeded your API rate limits</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          <p>
            <strong>Note:</strong> Your API key is stored securely in your browser and never shared.
            The College Football Data API provides comprehensive stats for all FBS teams and players.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}