'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, ArrowLeft, Truck, Lock, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';

const PERSONALITY_PRESETS = [
  { name: '🤝 Professional', values: { formality: 8, friendliness: 5, responseLength: 6, emojiUsage: 2 } },
  { name: '😊 Friendly Support', values: { formality: 4, friendliness: 9, responseLength: 7, emojiUsage: 6 } },
  { name: '⚡ Quick & Concise', values: { formality: 5, friendliness: 5, responseLength: 2, emojiUsage: 2 } },
  { name: '🌟 Sales Agent', values: { formality: 5, friendliness: 8, responseLength: 7, emojiUsage: 7 } },
  { name: '🧘 Calm & Patient', values: { formality: 6, friendliness: 8, responseLength: 8, emojiUsage: 3 } },
];

export default function ConnectionConfigPage() {
  const t = useTranslations('botConfig');
  const tCommon = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;
  const id = params.id as string;
  const { toast } = useToast();
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [predefinedMessages, setPredefinedMessages] = useState<any[]>([]);
  const [newKeywords, setNewKeywords] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [addingMsg, setAddingMsg] = useState(false);

  // Delivery fee
  const [deliveryFee, setDeliveryFee] = useState(0);

  // Ecotrack
  const [ecotrackUrl, setEcotrackUrl] = useState('');
  const [ecotrackToken, setEcotrackToken] = useState('');
  const [ecotrackAutoShip, setEcotrackAutoShip] = useState(false);
  const [ecotrackConfigured, setEcotrackConfigured] = useState(false);
  const [ecotrackSaving, setEcotrackSaving] = useState(false);

  useEffect(() => { fetchConnection(); }, []);

  const fetchConnection = async () => {
    const res = await fetch(`/api/connections/${id}`);
    const data = await res.json();
    setConnection(data);
    setForm({ name: data.name, businessName: data.businessName || '', botName: data.botName || 'Assistant', customInstructions: data.customInstructions || '', welcomeMessage: data.welcomeMessage || '', awayMessage: data.awayMessage || '', botPersonality: data.botPersonality || { formality: 5, friendliness: 5, responseLength: 5, emojiUsage: 3 }, isActive: data.isActive });
    setDeliveryFee(data.deliveryFee ?? 0);
    setPredefinedMessages(data.predefinedMessages || []);
    // Fetch Ecotrack config
    const eco = await fetch(`/api/connections/${id}/ecotrack`).then(r => r.json()).catch(() => ({}));
    setEcotrackUrl(eco.ecotrackUrl || '');
    setEcotrackConfigured(!!eco.ecotrackConfigured);
    setEcotrackAutoShip(!!eco.ecotrackAutoShip);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/connections/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, deliveryFee }) });
      if (res.ok) toast({ title: tCommon('success'), description: 'Configuration saved!' });
      else toast({ title: tCommon('error'), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleAddPredefined = async () => {
    if (!newKeywords || !newResponse) return;
    setAddingMsg(true);
    try {
      const res = await fetch(`/api/connections/${id}/predefined-messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: newKeywords.split(',').map((k: string) => k.trim()).filter(Boolean), response: newResponse, isActive: true, priority: predefinedMessages.length }) });
      if (res.ok) { setNewKeywords(''); setNewResponse(''); fetchConnection(); toast({ title: 'Message added!' }); }
    } finally { setAddingMsg(false); }
  };

  const updatePersonality = (key: string, value: number) => setForm((f: any) => ({ ...f, botPersonality: { ...f.botPersonality, [key]: value } }));

  const handleSaveEcotrack = async (remove = false) => {
    setEcotrackSaving(true);
    try {
      const res = await fetch(`/api/connections/${id}/ecotrack`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(remove ? { remove: true } : { url: ecotrackUrl, token: ecotrackToken, autoShip: ecotrackAutoShip }),
      });
      const data = await res.json();
      if (res.ok) {
        setEcotrackConfigured(!remove);
        if (remove) { setEcotrackUrl(''); setEcotrackToken(''); setEcotrackAutoShip(false); }
        else setEcotrackToken('');
        toast({ title: remove ? 'Ecotrack déconnecté' : '✅ Ecotrack configuré !', description: remove ? '' : 'Le bot validera maintenant les adresses via Ecotrack.' });
      } else {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
      }
    } finally { setEcotrackSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin w-8 h-8" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/dashboard/connections`}><Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button></Link>
        <div><h1 className="text-2xl font-bold">{connection.name}</h1><p className="text-muted-foreground">{connection.platform}</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('identity')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t('botName')}</Label><Input value={form.botName} onChange={e => setForm((f: any) => ({ ...f, botName: e.target.value }))} /></div>
            <div><Label>{t('businessName')}</Label><Input value={form.businessName} onChange={e => setForm((f: any) => ({ ...f, businessName: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={v => setForm((f: any) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('personality')}</CardTitle><CardDescription>Fine-tune how your bot communicates</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_PRESETS.map(preset => (
                <Button key={preset.name} variant="outline" size="sm" onClick={() => setForm((f: any) => ({ ...f, botPersonality: preset.values }))}>{preset.name}</Button>
              ))}
            </div>
          </div>
          {[
            { key: 'formality', label: t('formality'), left: t('casual'), right: t('formal') },
            { key: 'friendliness', label: t('friendliness'), left: t('professional'), right: t('veryWarm') },
            { key: 'responseLength', label: t('responseLength'), left: t('short'), right: t('detailed') },
            { key: 'emojiUsage', label: t('emojiUsage'), left: t('none'), right: t('frequent') },
          ].map(({ key, label, left, right }) => (
            <div key={key}>
              <div className="flex justify-between mb-2"><Label>{label}</Label><span className="text-sm text-muted-foreground">{form.botPersonality?.[key] ?? 5}/10</span></div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20">{left}</span>
                <Slider min={1} max={10} step={1} value={[form.botPersonality?.[key] ?? 5]} onValueChange={([v]) => updatePersonality(key, v)} className="flex-1" />
                <span className="text-xs text-muted-foreground w-20 text-end">{right}</span>
              </div>
            </div>
          ))}
          <div>
            <Label>{t('customInstructions')}</Label>
            <textarea className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.customInstructions} onChange={e => setForm((f: any) => ({ ...f, customInstructions: e.target.value }))} placeholder="Be funny, use emojis, keep responses under 3 sentences..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Livraison</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Frais de livraison (DA) <span className="text-xs text-muted-foreground">— affiché au client dans le récapitulatif</span></Label>
            <Input type="number" min={0} value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} placeholder="0" className="mt-1 max-w-[160px]" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>{t('welcomeMessage')}</Label><textarea className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.welcomeMessage} onChange={e => setForm((f: any) => ({ ...f, welcomeMessage: e.target.value }))} placeholder="Hello! How can I help you today?" /></div>
          <div><Label>{t('awayMessage')}</Label><textarea className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.awayMessage} onChange={e => setForm((f: any) => ({ ...f, awayMessage: e.target.value }))} placeholder="We're currently closed." /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('predefinedMessages')}</CardTitle><CardDescription>Keyword-triggered responses (0 tokens cost)</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {predefinedMessages.map((msg: any) => (
            <div key={msg.id} className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Keywords: {msg.keywords.join(', ')}</p>
              <p className="text-sm mt-1">{msg.response}</p>
            </div>
          ))}
          <div className="border rounded-lg p-3 space-y-3 border-dashed">
            <p className="text-sm font-medium">Add new</p>
            <div><Label className="text-xs">Keywords (comma-separated)</Label><Input value={newKeywords} onChange={e => setNewKeywords(e.target.value)} placeholder="price, tarif, كم الثمن" className="mt-1" /></div>
            <div><Label className="text-xs">Response</Label><textarea className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newResponse} onChange={e => setNewResponse(e.target.value)} placeholder="Our prices start from..." /></div>
            <Button size="sm" onClick={handleAddPredefined} disabled={addingMsg || !newKeywords || !newResponse}>
              {addingMsg ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4 me-1" />}Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ecotrack integration */}
      {(() => {
        const planLevel = connection?._planLevel ?? 'FREE';
        const allowed = ['BUSINESS', 'PRO', 'AGENCY'].includes(planLevel);
        return (
          <Card className={!allowed ? 'opacity-70' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-orange-500" />
                  <CardTitle>Intégration Ecotrack</CardTitle>
                  {!allowed && (
                    <span className="ml-2 text-xs font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Business+
                    </span>
                  )}
                  {ecotrackConfigured && allowed && (
                    <span className="ml-2 text-xs font-mono bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Connecté
                    </span>
                  )}
                </div>
                {ecotrackConfigured && allowed && (
                  <Button variant="ghost" size="sm" onClick={() => handleSaveEcotrack(true)} disabled={ecotrackSaving} className="text-red-400 hover:text-red-300">
                    <X className="w-4 h-4 me-1" /> Déconnecter
                  </Button>
                )}
              </div>
              <CardDescription>
                {allowed
                  ? 'Le bot validera automatiquement les wilayas/communes, proposera domicile ou Stop Desk, et créera les expéditions sur Ecotrack.'
                  : 'Disponible à partir du pack Business. Le bot validera les adresses et créera les expéditions automatiquement.'}
              </CardDescription>
            </CardHeader>
            {allowed && (
              <CardContent className="space-y-4">
                <div>
                  <Label>URL Ecotrack <span className="text-xs text-muted-foreground">(ex: https://ecotrack.app)</span></Label>
                  <Input value={ecotrackUrl} onChange={e => setEcotrackUrl(e.target.value)} placeholder="https://ecotrack.app" className="mt-1" />
                </div>
                <div>
                  <Label>Token API {ecotrackConfigured && <span className="text-xs text-green-400 ml-2">● Token enregistré</span>}</Label>
                  <Input type="password" value={ecotrackToken} onChange={e => setEcotrackToken(e.target.value)} placeholder={ecotrackConfigured ? '••••••••••••••••' : 'Votre token API Ecotrack'} className="mt-1" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <Switch checked={ecotrackAutoShip} onCheckedChange={setEcotrackAutoShip} />
                  <div>
                    <p className="text-sm font-medium">Expédition automatique</p>
                    <p className="text-xs text-muted-foreground">Expédie automatiquement sur Ecotrack quand le client confirme sa commande depuis le bot.</p>
                  </div>
                </div>
                <Button onClick={() => handleSaveEcotrack(false)} disabled={ecotrackSaving || !ecotrackUrl || (!ecotrackToken && !ecotrackConfigured)}>
                  {ecotrackSaving ? <Loader2 className="animate-spin me-2 w-4 h-4" /> : <Truck className="me-2 w-4 h-4" />}
                  {ecotrackConfigured ? 'Mettre à jour' : 'Connecter Ecotrack'}
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })()}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="animate-spin me-2" /> : null}{tCommon('save')}
        </Button>
      </div>
    </div>
  );
}
