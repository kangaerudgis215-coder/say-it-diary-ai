 import { useState } from 'react';
 import { Loader2, Sparkles } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { supabase } from '@/lib/supabase';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 
 interface AddExpressionDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   initialExpression: string;
   exampleSentence?: string;
   diaryEntryId?: string;
   onSaved?: () => void;
 }
 
 const SCENE_OPTIONS = [
   'Daily life',
   'Work',
   'School',
   'Feelings',
   'Travel',
   'Social',
   'Other',
 ];
 
 const TYPE_OPTIONS = [
   'Verb phrase',
   'Noun phrase',
   'Adjective phrase',
   'Adverb phrase',
   'Idiom',
   'Fixed phrase',
   'Other',
 ];
 
 export function AddExpressionDialog({
   open,
   onOpenChange,
   initialExpression,
   exampleSentence = '',
   diaryEntryId,
   onSaved,
 }: AddExpressionDialogProps) {
   const { user } = useAuth();
   const { toast } = useToast();
   
   const [expression, setExpression] = useState(initialExpression);
   const [meaning, setMeaning] = useState('');
   const [example, setExample] = useState(exampleSentence);
   const [scene, setScene] = useState('Daily life');
   const [type, setType] = useState('Fixed phrase');
   const [isSaving, setIsSaving] = useState(false);
   const [isGeneratingMeaning, setIsGeneratingMeaning] = useState(false);
 
   // Reset form when dialog opens with new expression
   useState(() => {
     setExpression(initialExpression);
     setExample(exampleSentence);
     setMeaning('');
   });
 
   const handleGenerateMeaning = async () => {
     if (!expression) return;
     
     setIsGeneratingMeaning(true);
     try {
       // Simple AI call to generate meaning
       const { data, error } = await supabase.functions.invoke('chat', {
         body: {
           messages: [{
             role: 'user',
             content: `Please provide a brief Japanese translation/explanation for the English expression: "${expression}". Just give me the Japanese meaning in one short sentence, no other text.`,
           }],
           systemPrompt: 'You are a helpful translator. Provide only the Japanese translation/explanation, nothing else.',
         },
       });
       
       if (data?.message) {
         setMeaning(data.message);
       }
     } catch (error) {
       console.error('Failed to generate meaning:', error);
       toast({
         variant: 'destructive',
         title: 'Error',
         description: 'Could not generate meaning. Please enter it manually.',
       });
     } finally {
       setIsGeneratingMeaning(false);
     }
   };
 
   const handleSave = async () => {
     if (!user || !expression.trim()) return;
     
     setIsSaving(true);
     try {
       const { error } = await supabase.from('expressions').insert({
         user_id: user.id,
         diary_entry_id: diaryEntryId || null,
         expression: expression.trim(),
         meaning: meaning.trim() || null,
         example_sentence: example.trim() || null,
         scene_or_context: scene,
         pos_or_type: type,
         is_user_added: true,
         mastery_level: 0,
       });
 
       if (error) throw error;
 
       toast({
         title: 'Expression saved!',
         description: `"${expression}" has been added to your expressions.`,
       });
       
       onOpenChange(false);
       onSaved?.();
     } catch (error) {
       console.error('Failed to save expression:', error);
       toast({
         variant: 'destructive',
         title: 'Error',
         description: 'Could not save expression. Please try again.',
       });
     } finally {
       setIsSaving(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Sparkles className="w-5 h-5 text-primary" />
             Save Expression
           </DialogTitle>
           <DialogDescription>
             Add this phrase to your personal expression collection.
           </DialogDescription>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Expression text */}
           <div className="space-y-2">
             <Label htmlFor="expression">Expression</Label>
             <Input
               id="expression"
               value={expression}
               onChange={(e) => setExpression(e.target.value)}
               placeholder="e.g., look forward to"
             />
           </div>
 
           {/* Japanese meaning */}
           <div className="space-y-2">
             <Label htmlFor="meaning" className="flex items-center justify-between">
               Japanese Meaning
               <Button
                 type="button"
                 variant="ghost"
                 size="sm"
                 onClick={handleGenerateMeaning}
                 disabled={isGeneratingMeaning || !expression}
                 className="h-6 text-xs"
               >
                 {isGeneratingMeaning ? (
                   <Loader2 className="w-3 h-3 animate-spin mr-1" />
                 ) : (
                   <Sparkles className="w-3 h-3 mr-1" />
                 )}
                 AI Generate
               </Button>
             </Label>
             <Textarea
               id="meaning"
               value={meaning}
               onChange={(e) => setMeaning(e.target.value)}
               placeholder="〜を楽しみにする"
               rows={2}
             />
           </div>
 
           {/* Example sentence */}
           <div className="space-y-2">
             <Label htmlFor="example">Example Sentence</Label>
             <Textarea
               id="example"
               value={example}
               onChange={(e) => setExample(e.target.value)}
               placeholder="The sentence where you found this expression"
               rows={2}
             />
           </div>
 
           {/* Scene and Type */}
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-2">
               <Label>Scene / Context</Label>
               <Select value={scene} onValueChange={setScene}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {SCENE_OPTIONS.map((s) => (
                     <SelectItem key={s} value={s}>{s}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label>Type</Label>
               <Select value={type} onValueChange={setType}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {TYPE_OPTIONS.map((t) => (
                     <SelectItem key={t} value={t}>{t}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
         </div>
 
         <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="ghost" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button onClick={handleSave} disabled={isSaving || !expression.trim()}>
             {isSaving ? (
               <Loader2 className="w-4 h-4 animate-spin mr-2" />
             ) : null}
             Save Expression
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }