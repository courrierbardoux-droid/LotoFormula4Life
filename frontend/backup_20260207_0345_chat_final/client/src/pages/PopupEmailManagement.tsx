
import React, { useState, useEffect, useRef } from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { useUser } from '@/lib/UserContext';
import { toast } from 'sonner';
import { RefreshCw, Upload, Save, Eye, Mail, MessageSquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import * as pdfjsLib from 'pdfjs-dist';

// Configuration pdfjs-dist - utiliser unpkg CDN (plus fiable que cdnjs)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type TemplateType = 'email1' | 'email2' | 'popup1' | 'popup2';

interface Template {
  id?: number;
  type: TemplateType;
  content: string;
  variablesConfig?: Record<string, string>;
}

interface TemplateVariable {
  id?: number;
  key: string;
  value: string;
  description: string;
}

const TEMPLATE_LABELS: Record<TemplateType, { title: string; description: string; icon: React.ReactNode }> = {
  email1: {
    title: 'Email 1 - Validation Gratitude',
    description: 'Email de validation avec message de gratitude',
    icon: <Mail size={20} />
  },
  email2: {
    title: 'Email 2 - "Voici vos numéros"',
    description: 'Email contenant les numéros générés',
    icon: <Mail size={20} />
  },
  popup1: {
    title: 'Popup 1 - "Validation gratitude"',
    description: 'Popup de gratitude avec case à accepter (mode invite-send)',
    icon: <MessageSquare size={20} />
  },
  popup2: {
    title: 'Popup 2 - "Voir les numéros ?"',
    description: 'Popup de consultation après validation (Oui/Non)',
    icon: <MessageSquare size={20} />
  }
};

const DEFAULT_VARIABLES: Record<string, string> = {
  '#utilisateur': 'user.username',
  '#email': 'user.email',
  '#contactdéveloppeur': 'support@lotoformula4life.com',
  '#date': 'new Date().toLocaleDateString("fr-FR")',
  '#numéros': 'grid.numbers.join(", ")',
  '#étoiles': 'grid.stars.join(", ")',
  '#mise à jour Historique Euromillions': 'https://www.euro-millions.com/results',
  '#url_site': 'https://lotoformula4life.onrender.com'
};

export default function PopupEmailManagement() {
  const { user } = useUser();
  const fileInputRefs = useRef<Record<TemplateType, HTMLInputElement | null>>({
    email1: null,
    email2: null,
    popup1: null,
    popup2: null
  });
  const [templates, setTemplates] = useState<Record<TemplateType, Template>>({
    email1: { type: 'email1', content: '' },
    email2: { type: 'email2', content: '' },
    popup1: { type: 'popup1', content: '' },
    popup2: { type: 'popup2', content: '' }
  });
  const [variables, setVariables] = useState<Record<string, string>>(DEFAULT_VARIABLES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<TemplateType, boolean>>({
    email1: false,
    email2: false,
    popup1: false,
    popup2: false
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewType, setPreviewType] = useState<TemplateType | null>(null);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Charger les templates et variables au montage
  useEffect(() => {
    loadTemplates();
    loadVariables();
  }, []);

  const loadTemplates = async () => {
    try {
      console.log('[PopupEmailManagement] Chargement des templates...');
      setLoading(true);
      const res = await fetch('/api/admin/templates', { credentials: 'include' });
      console.log('[PopupEmailManagement] Réponse API:', res.status, res.ok);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[PopupEmailManagement] Données reçues:', {
          templatesCount: data.templates?.length || 0,
          templates: data.templates?.map((t: Template) => ({ type: t.type, contentLength: t.content?.length || 0 }))
        });
        
        const loadedTemplates: Record<TemplateType, Template> = {
          email1: { type: 'email1', content: '' },
          email2: { type: 'email2', content: '' },
          popup1: { type: 'popup1', content: '' },
          popup2: { type: 'popup2', content: '' }
        };
        
        if (data.templates && Array.isArray(data.templates)) {
          data.templates.forEach((t: Template) => {
            console.log(`[PopupEmailManagement] Chargement template ${t.type}: ${t.content?.length || 0} caractères`);
            loadedTemplates[t.type] = t;
          });
        } else {
          console.warn('[PopupEmailManagement] data.templates n\'est pas un tableau:', data);
        }
        
        console.log('[PopupEmailManagement] Templates chargés:', {
          email1: loadedTemplates.email1.content.length,
          email2: loadedTemplates.email2.content.length,
          popup1: loadedTemplates.popup1.content.length,
          popup2: loadedTemplates.popup2.content.length
        });
        
        setTemplates(loadedTemplates);
      } else {
        console.error('[PopupEmailManagement] Erreur API:', res.status, await res.text());
        toast.error('Erreur lors du chargement des templates');
      }
    } catch (error) {
      console.error('[PopupEmailManagement] Erreur chargement templates:', error);
      toast.error('Erreur lors du chargement des templates');
    } finally {
      setLoading(false);
    }
  };

  const loadVariables = async () => {
    try {
      // Initialiser avec les valeurs par défaut
      const vars: Record<string, string> = { ...DEFAULT_VARIABLES };
      
      // Charger les variables depuis la DB et remplacer les valeurs par défaut
      const res = await fetch('/api/admin/template-variables', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.variables && Array.isArray(data.variables)) {
          data.variables.forEach((v: TemplateVariable) => {
            // Remplacer seulement si la clé existe dans DEFAULT_VARIABLES
            const key = `#${v.key}`;
            if (key in DEFAULT_VARIABLES) {
              vars[key] = v.value;
            }
          });
        }
      }
      
      setVariables(vars);
    } catch (error) {
      console.error('Erreur chargement variables:', error);
      // En cas d'erreur, utiliser les valeurs par défaut
      setVariables({ ...DEFAULT_VARIABLES });
    }
  };

  // Fonction pour extraire le texte d'un PDF avec formatage de base
  const extractTextFromPDF = async (file: File): Promise<string> => {
    console.log('[extractTextFromPDF] ÉTAPE 1: Début extraction PDF', { fileName: file.name, fileSize: file.size });
    
    try {
      console.log('[extractTextFromPDF] ÉTAPE 2: Conversion en ArrayBuffer');
      const arrayBuffer = await file.arrayBuffer();
      console.log('[extractTextFromPDF] ÉTAPE 3: Chargement PDF avec pdfjs');
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      console.log('[extractTextFromPDF] ÉTAPE 4: PDF chargé', { numPages: pdf.numPages });
      let htmlContent = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log('[extractTextFromPDF] ÉTAPE 5: Traitement page', { pageNum, totalPages: pdf.numPages });
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        console.log('[extractTextFromPDF] ÉTAPE 6: Contenu texte récupéré', { itemsCount: textContent.items.length });
        
        let lastY = 0;
        let currentParagraph: string[] = [];
        let currentFontSize = 0;
        
        textContent.items.forEach((item: any) => {
          const y = item.transform[5];
          const fontSize = item.transform[0];
          const text = item.str.trim();
          
          if (!text) return;
          
          // Détection de nouveaux paragraphes (changement de ligne Y significatif)
          const yDiff = Math.abs(y - lastY);
          if (yDiff > 8 && currentParagraph.length > 0) {
            const paraText = currentParagraph.join(' ');
            // Détection des titres (police plus grande ou texte court en début de ligne)
            if (currentFontSize > 14 || (currentParagraph.length === 1 && paraText.length < 50)) {
              htmlContent += `<h2>${paraText}</h2>\n`;
            } else {
              htmlContent += `<p>${paraText}</p>\n`;
            }
            currentParagraph = [];
          }
          
          currentParagraph.push(text);
          currentFontSize = fontSize;
          lastY = y;
        });
        
        // Ajouter le dernier paragraphe
        if (currentParagraph.length > 0) {
          const paraText = currentParagraph.join(' ');
          if (currentFontSize > 14 || (currentParagraph.length === 1 && paraText.length < 50)) {
            htmlContent += `<h2>${paraText}</h2>\n`;
          } else {
            htmlContent += `<p>${paraText}</p>\n`;
          }
        }
        
        // Ajouter une séparation entre les pages
        if (pageNum < pdf.numPages) {
          htmlContent += '<hr />\n';
        }
      }
      
      console.log('[extractTextFromPDF] ÉTAPE FINALE: Extraction terminée', { htmlContentLength: htmlContent.length });
      return htmlContent || '<p>Aucun texte extrait du PDF</p>';
    } catch (error) {
      console.error('[extractTextFromPDF] ERREUR:', error);
      throw new Error('Erreur lors de l\'extraction du texte du PDF. Vérifiez que le fichier est un PDF valide.');
    }
  };

  const handleFileUpload = async (type: TemplateType, file: File) => {
    console.log('[handleFileUpload] ÉTAPE 1: Début de handleFileUpload', { type, fileName: file.name, fileType: file.type, fileSize: file.size });
    
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isHTML = file.type.includes('html') || file.name.toLowerCase().endsWith('.html');
    const isTXT = file.type.includes('text') || file.name.toLowerCase().endsWith('.txt');
    const isMD = file.name.toLowerCase().endsWith('.md');
    
    console.log('[handleFileUpload] ÉTAPE 2: Vérification type fichier', { isPDF, isHTML, isTXT, isMD });
    
    if (!isPDF && !isHTML && !isTXT && !isMD) {
      console.log('[handleFileUpload] ERREUR: Type de fichier non supporté');
      toast.error('Fichier non supporté. Utilisez .pdf, .html, .txt ou .md');
      return;
    }

    try {
      console.log('[handleFileUpload] ÉTAPE 3: Début traitement fichier');
      let content = '';
      
      if (isPDF) {
        console.log('[handleFileUpload] ÉTAPE 4: Extraction PDF');
        // Extraire le texte du PDF
        content = await extractTextFromPDF(file);
        console.log('[handleFileUpload] ÉTAPE 5: PDF extrait, longueur:', content.length);
        toast.success(`Texte du PDF extrait pour ${TEMPLATE_LABELS[type].title}. Formatez-le en HTML si nécessaire.`);
      } else {
        console.log('[handleFileUpload] ÉTAPE 4: Lecture fichier texte');
        // Lire les fichiers texte/HTML normalement
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            console.log('[handleFileUpload] ÉTAPE 5: Fichier lu avec succès');
            resolve(e.target?.result as string);
          };
          reader.onerror = (error) => {
            console.error('[handleFileUpload] ERREUR FileReader:', error);
            reject(error);
          };
          reader.readAsText(file);
        });
        console.log('[handleFileUpload] ÉTAPE 6: Contenu récupéré, longueur:', content.length);
      }
      
      console.log('[handleFileUpload] ÉTAPE 7: Mise à jour du state templates');
      setTemplates(prev => {
        const updated = {
          ...prev,
          [type]: { ...prev[type], content }
        };
        console.log('[handleFileUpload] ÉTAPE 8: State mis à jour', { type, contentLength: content.length });
        return updated;
      });
      
      if (!isPDF) {
        toast.success(`Fichier chargé pour ${TEMPLATE_LABELS[type].title}`);
      }
      console.log('[handleFileUpload] ÉTAPE FINALE: Succès');
    } catch (error: any) {
      console.error('[handleFileUpload] ERREUR:', error);
      toast.error(error.message || 'Erreur lors de la lecture du fichier');
    }
  };

  const handleSaveTemplate = async (type: TemplateType) => {
    console.log('[handleSaveTemplate] ÉTAPE 1: Début de handleSaveTemplate', { type });
    
    try {
      console.log('[handleSaveTemplate] ÉTAPE 2: Mise à jour state saving');
      setSaving(prev => ({ ...prev, [type]: true }));
      
      const template = templates[type];
      console.log('[handleSaveTemplate] ÉTAPE 3: Template récupéré', { 
        type, 
        contentLength: template.content?.length || 0,
        hasVariablesConfig: !!template.variablesConfig 
      });
      
      const payload = {
        type,
        content: template.content,
        variablesConfig: template.variablesConfig || {}
      };
      console.log('[handleSaveTemplate] ÉTAPE 4: Préparation payload', { payloadSize: JSON.stringify(payload).length });
      
      console.log('[handleSaveTemplate] ÉTAPE 5: Envoi requête API');
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      console.log('[handleSaveTemplate] ÉTAPE 6: Réponse reçue', { status: res.status, ok: res.ok });

      if (res.ok) {
        const data = await res.json();
        console.log('[handleSaveTemplate] ÉTAPE 7: Succès, données:', data);
        toast.success(`${TEMPLATE_LABELS[type].title} sauvegardé`);
        
        console.log('[handleSaveTemplate] ÉTAPE 8: Rechargement templates');
        await loadTemplates();
        console.log('[handleSaveTemplate] ÉTAPE FINALE: Succès complet');
      } else {
        const data = await res.json();
        console.error('[handleSaveTemplate] ERREUR API:', data);
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('[handleSaveTemplate] ERREUR:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      console.log('[handleSaveTemplate] FINALLY: Réinitialisation state saving');
      setSaving(prev => ({ ...prev, [type]: false }));
    }
  };

  const handlePreview = (type: TemplateType) => {
    console.log('[handlePreview] ÉTAPE 1: Début de handlePreview', { type });
    
    const template = templates[type];
    console.log('[handlePreview] ÉTAPE 2: Template récupéré', { 
      type, 
      hasContent: !!template.content,
      contentLength: template.content?.length || 0 
    });
    
    if (!template.content) {
      console.log('[handlePreview] ERREUR: Template vide');
      toast.error('Le template est vide');
      return;
    }

    console.log('[handlePreview] ÉTAPE 3: Début remplacement variables', { variablesCount: Object.keys(variables).length });
    // Remplacer les variables par des valeurs de démonstration
    let preview = template.content;
    Object.keys(variables).forEach(key => {
      const varName = key.replace('#', '');
      const demoValue = getDemoValue(varName);
      console.log('[handlePreview] ÉTAPE 4: Remplacement variable', { key, varName, demoValue });
      // Échapper les caractères spéciaux pour la regex, y compris les espaces
      const escapedKey = key.replace(/[#.*+?^${}()|[\]\\]/g, '\\$&');
      const beforeReplace = preview;
      preview = preview.replace(new RegExp(escapedKey, 'g'), demoValue);
      if (beforeReplace !== preview) {
        console.log('[handlePreview] ÉTAPE 5: Variable remplacée', { key, replaced: true });
      }
    });

    console.log('[handlePreview] ÉTAPE 6: Prévisualisation créée', { previewLength: preview.length });
    console.log('[handlePreview] ÉTAPE 7: Mise à jour state preview');
    setPreviewContent(preview);
    setPreviewType(type);
    setPreviewOpen(true);
    console.log('[handlePreview] ÉTAPE FINALE: Aperçu ouvert');
  };

  const getDemoValue = (varName: string): string => {
    const varKey = `#${varName}`;
    
    // Si la variable existe dans notre state, utiliser sa valeur
    if (varKey in variables) {
      return variables[varKey];
    }
    
    // Valeurs de démonstration par défaut
    switch (varName) {
      case 'utilisateur': return 'DemoUser';
      case 'email': return 'demo@example.com';
      case 'contactdéveloppeur': return 'support@lotoformula4life.com';
      case 'date': return new Date().toLocaleDateString('fr-FR');
      case 'numéros': return '5, 12, 23, 34, 45';
      case 'étoiles': return '3, 9';
      case 'mise à jour Historique Euromillions': return 'https://www.euro-millions.com/results';
      case 'url_site': return 'https://lotoformula4life.onrender.com';
      default: return `[${varName}]`;
    }
  };

  const handleTestEmail = async (type: TemplateType) => {
    console.log('[handleTestEmail] ÉTAPE 1: Début de handleTestEmail', { type, testEmail });
    
    if (!testEmail || !testEmail.includes('@')) {
      console.log('[handleTestEmail] ERREUR: Email invalide', { testEmail });
      toast.error('Email invalide');
      return;
    }

    try {
      console.log('[handleTestEmail] ÉTAPE 2: Mise à jour state testEmailSending');
      setTestEmailSending(true);
      
      const template = templates[type];
      const payload = {
        type,
        email: testEmail,
        content: template.content
      };
      console.log('[handleTestEmail] ÉTAPE 3: Préparation payload', { 
        type, 
        email: testEmail, 
        contentLength: template.content?.length || 0 
      });
      
      console.log('[handleTestEmail] ÉTAPE 4: Envoi requête API');
      const res = await fetch('/api/admin/templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      console.log('[handleTestEmail] ÉTAPE 5: Réponse reçue', { status: res.status, ok: res.ok });

      if (res.ok) {
        const data = await res.json();
        console.log('[handleTestEmail] ÉTAPE 6: Succès, données:', data);
        toast.success(`Email de test envoyé à ${testEmail}`);
        setTestEmailOpen(false);
        setTestEmail('');
        console.log('[handleTestEmail] ÉTAPE FINALE: Succès complet');
      } else {
        // Gérer les erreurs 404 ou autres erreurs serveur
        let errorMessage = 'Erreur lors de l\'envoi';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
          } else {
            // Le serveur a retourné du HTML (404 page) au lieu de JSON
            if (res.status === 404) {
              errorMessage = 'Route API non trouvée. Vérifiez que le serveur est démarré et que la route existe.';
            } else {
              errorMessage = `Erreur serveur (${res.status}). Vérifiez les logs du serveur.`;
            }
          }
        } catch (parseError) {
          // Si on ne peut pas parser la réponse d'erreur
          if (res.status === 404) {
            errorMessage = 'Route API non trouvée. Vérifiez que le serveur est démarré.';
          } else {
            errorMessage = `Erreur serveur (${res.status}).`;
          }
        }
        console.error('[handleTestEmail] ERREUR API:', { status: res.status, errorMessage });
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('[handleTestEmail] ERREUR:', error);
      const errorMessage = error.message?.includes('JSON') 
        ? 'Erreur de communication avec le serveur. Vérifiez que le serveur est démarré sur le port 3000.'
        : 'Erreur lors de l\'envoi';
      toast.error(errorMessage);
    } finally {
      console.log('[handleTestEmail] FINALLY: Réinitialisation state testEmailSending');
      setTestEmailSending(false);
    }
  };

  const updateTemplateContent = (type: TemplateType, content: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: { ...prev[type], content }
    }));
  };

  const handleVariableClick = (key: string) => {
    // Permettre l'édition uniquement pour les 3 variables spécifiées
    const editableVars = ['#contactdéveloppeur', '#mise à jour Historique Euromillions', '#url_site'];
    if (editableVars.includes(key)) {
      setEditingVariable(key);
      setEditingValue(variables[key]);
    }
  };

  const handleVariableSave = async () => {
    if (!editingVariable) return;

    const varKey = editingVariable.replace('#', '');
    
    try {
      const res = await fetch('/api/admin/template-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: varKey,
          value: editingValue,
          description: `Variable ${editingVariable}`
        })
      });

      if (res.ok) {
        setVariables(prev => ({
          ...prev,
          [editingVariable]: editingValue
        }));
        toast.success(`Variable ${editingVariable} mise à jour`);
        setEditingVariable(null);
        setEditingValue('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleVariableCancel = () => {
    setEditingVariable(null);
    setEditingValue('');
  };

  if (loading) {
    return (
      <CasinoLayout>
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-casino-gold mb-4"></div>
            <p className="text-xl font-orbitron text-white tracking-widest">CHARGEMENT...</p>
          </div>
        </div>
      </CasinoLayout>
    );
  }

  return (
    <CasinoLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        
        {/* TITRE CENTRÉ */}
        <div className="text-center my-12 py-6 relative">
          <h1 className="text-4xl md:text-5xl font-orbitron font-black text-white tracking-widest text-shadow-glow mb-2">
            GESTION DES POPUPS & EMAILS
          </h1>
          <div className="h-1 w-48 bg-casino-gold mx-auto rounded-full shadow-[0_0_15px_rgba(255,215,0,0.8)]" />
        </div>

        {/* VARIABLES DISPONIBLES */}
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] mb-6">
          <h2 className="font-orbitron text-casino-gold text-xl tracking-widest border-b border-zinc-800 pb-2 mb-4 flex items-center gap-2">
            <FileText size={24} />
            VARIABLES DISPONIBLES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(variables).map(key => {
              const isEditable = ['#contactdéveloppeur', '#mise à jour Historique Euromillions', '#url_site'].includes(key);
              const isEditing = editingVariable === key;
              
              return (
                <div 
                  key={key} 
                  className={cn(
                    "bg-black/50 border rounded p-3 transition-all",
                    isEditable ? "border-zinc-600 hover:border-casino-gold cursor-pointer hover:bg-black/70" : "border-zinc-700"
                  )}
                  onClick={() => isEditable && handleVariableClick(key)}
                >
                  <div className="text-casino-gold font-mono font-bold text-sm flex items-center gap-2">
                    {key}
                    {isEditable && !isEditing && (
                      <span className="text-xs text-zinc-500">(cliquez pour modifier)</span>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="bg-black/50 border-zinc-600 text-white text-xs"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVariableSave();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleVariableCancel();
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVariableSave();
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-6"
                        >
                          ✓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVariableCancel();
                          }}
                          className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs px-2 py-1 h-6"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-400 text-xs mt-1 break-all">{variables[key]}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-zinc-500 text-sm mt-4 italic">
            💡 Utilisez ces variables dans vos templates. Elles seront automatiquement remplacées lors de l'envoi.
            <br />
            <span className="text-casino-gold">Cliquez sur les variables en surbrillance pour les modifier.</span>
          </p>
        </div>

        {/* TEMPLATES */}
        {(['email1', 'email2', 'popup1', 'popup2'] as TemplateType[]).map(type => {
          const template = templates[type];
          const label = TEMPLATE_LABELS[type];
          
          return (
            <div key={type} className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-zinc-700 rounded-lg p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <div className="font-orbitron text-casino-gold text-lg tracking-widest border-b border-zinc-800 pb-2 mb-4 flex items-center gap-2">
                {label.icon}
                {label.title}
              </div>
              <p className="text-zinc-400 text-sm mb-4">{label.description}</p>

              {/* Boutons d'action */}
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  type="file"
                  ref={(el) => { fileInputRefs.current[type] = el; }}
                  accept=".pdf,.html,.txt,.md,application/pdf,text/html,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    console.log('[FileInput onChange] ÉTAPE 1: Fichier sélectionné', { type, filesCount: e.target.files?.length || 0 });
                    const file = e.target.files?.[0];
                    if (file) {
                      console.log('[FileInput onChange] ÉTAPE 2: Appel handleFileUpload', { type, fileName: file.name });
                      handleFileUpload(type, file);
                    } else {
                      console.log('[FileInput onChange] ERREUR: Aucun fichier sélectionné');
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('[Button Upload] Clic sur bouton Charger un fichier', { type });
                    fileInputRefs.current[type]?.click();
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-600"
                >
                  <Upload size={16} className="mr-2" />
                  Charger un fichier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('[Button Preview] Clic sur bouton Aperçu', { type });
                    handlePreview(type);
                  }}
                  className="bg-blue-900 hover:bg-blue-800 text-white border-blue-700"
                >
                  <Eye size={16} className="mr-2" />
                  Aperçu
                </Button>
                {(type === 'email1' || type === 'email2') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('[Button TestEmail] Clic sur bouton Test email', { type });
                      setPreviewType(type);
                      setTestEmailOpen(true);
                    }}
                    className="bg-purple-900 hover:bg-purple-800 text-white border-purple-700"
                  >
                    <Mail size={16} className="mr-2" />
                    Test email
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('[Button Save] Clic sur bouton Sauvegarder', { type, isSaving: saving[type] });
                    handleSaveTemplate(type);
                  }}
                  disabled={saving[type]}
                  className="bg-green-900 hover:bg-green-800 text-white border-green-700 disabled:opacity-50"
                >
                  <Save size={16} className="mr-2" />
                  {saving[type] ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>

              {/* Éditeur */}
              <Textarea
                value={template.content}
                onChange={(e) => updateTemplateContent(type, e.target.value)}
                placeholder={`Contenu HTML du template ${label.title}...`}
                className="w-full min-h-[300px] font-mono text-sm bg-black/50 border-zinc-700 text-white"
                style={{ fontFamily: 'monospace' }}
              />
              <div className="text-zinc-500 text-xs mt-2">
                {template.content.length} caractères
              </div>
            </div>
          );
        })}

      </div>

      {/* Dialog Aperçu */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-casino-gold">
          <DialogHeader>
            <DialogTitle className="text-casino-gold font-orbitron">
              Aperçu - {previewType && TEMPLATE_LABELS[previewType].title}
            </DialogTitle>
          </DialogHeader>
          <div 
            className="mt-4 p-4 bg-white rounded preview-container"
            style={{
              color: '#000000',
              fontFamily: 'Arial, sans-serif',
            }}
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
          <style>{`
            /* Styles pour forcer la visibilité du texte dans l'aperçu */
            .preview-container * {
              color: #000000 !important;
            }
            .preview-container p,
            .preview-container span,
            .preview-container div,
            .preview-container td,
            .preview-container li {
              color: #000000 !important;
            }
            .preview-container h1,
            .preview-container h2,
            .preview-container h3,
            .preview-container h4,
            .preview-container h5,
            .preview-container h6 {
              color: #000000 !important;
            }
            /* Si le texte est explicitement en blanc/clair, le forcer en noir */
            .preview-container [style*="color: #fff"],
            .preview-container [style*="color: #ffffff"],
            .preview-container [style*="color: white"],
            .preview-container [style*="color: rgb(255"],
            .preview-container [style*="color: rgba(255"] {
              color: #000000 !important;
            }
            /* Améliorer la visibilité des liens */
            .preview-container a {
              color: #0066cc !important;
            }
          `}</style>
          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Test Email */}
      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent className="bg-zinc-900 border-casino-gold">
          <DialogHeader>
            <DialogTitle className="text-casino-gold font-orbitron">
              Envoyer un email de test
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Entrez une adresse email pour recevoir le template {previewType && TEMPLATE_LABELS[previewType].title}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Input
              type="email"
              placeholder="email@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="bg-black/50 border-zinc-700 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailOpen(false)}>Annuler</Button>
            <Button
              onClick={() => {
                console.log('[Dialog TestEmail Button] Clic sur bouton Envoyer', { previewType, testEmail, testEmailSending });
                if (previewType) handleTestEmail(previewType);
              }}
              disabled={testEmailSending || !testEmail}
              className="bg-green-600 hover:bg-green-700"
            >
              {testEmailSending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </CasinoLayout>
  );
}
