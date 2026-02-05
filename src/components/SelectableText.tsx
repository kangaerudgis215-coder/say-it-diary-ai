 import { useState, useRef, useCallback } from 'react';
 import { Plus } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { AddExpressionDialog } from '@/components/AddExpressionDialog';
 import { cn } from '@/lib/utils';
 
 interface SelectableTextProps {
   text: string;
   diaryEntryId?: string;
   className?: string;
   onExpressionSaved?: () => void;
 }
 
 export function SelectableText({ 
   text, 
   diaryEntryId, 
   className,
   onExpressionSaved 
 }: SelectableTextProps) {
   const containerRef = useRef<HTMLParagraphElement>(null);
   const [selectedText, setSelectedText] = useState('');
   const [showButton, setShowButton] = useState(false);
   const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });
   const [dialogOpen, setDialogOpen] = useState(false);
   const [fullSentence, setFullSentence] = useState('');
 
   const handleMouseUp = useCallback(() => {
     const selection = window.getSelection();
     if (!selection || selection.isCollapsed) {
       setShowButton(false);
       return;
     }
 
     const selectedStr = selection.toString().trim();
     if (selectedStr.length < 2) {
       setShowButton(false);
       return;
     }
 
     // Get the position for the button
     const range = selection.getRangeAt(0);
     const rect = range.getBoundingClientRect();
     const containerRect = containerRef.current?.getBoundingClientRect();
     
     if (containerRect) {
       setButtonPosition({
         x: rect.left - containerRect.left + rect.width / 2,
         y: rect.top - containerRect.top - 40,
       });
     }
 
     // Find the sentence containing the selection
     const sentences = text.split(/(?<=[.!?])\s+/);
     const foundSentence = sentences.find(s => 
       s.toLowerCase().includes(selectedStr.toLowerCase())
     );
 
     setSelectedText(selectedStr);
     setFullSentence(foundSentence || '');
     setShowButton(true);
   }, [text]);
 
   const handleAddExpression = useCallback(() => {
     setDialogOpen(true);
     setShowButton(false);
     window.getSelection()?.removeAllRanges();
   }, []);
 
   const handleDialogClose = useCallback((open: boolean) => {
     setDialogOpen(open);
     if (!open) {
       setSelectedText('');
       setFullSentence('');
     }
   }, []);
 
   return (
     <div className="relative">
       <p
         ref={containerRef}
         className={cn("select-text cursor-text", className)}
         onMouseUp={handleMouseUp}
         onTouchEnd={handleMouseUp}
       >
         {text}
       </p>
 
       {/* Floating add button */}
       {showButton && (
         <div
           className="absolute z-50 animate-in fade-in zoom-in-90 duration-150"
           style={{
             left: `${buttonPosition.x}px`,
             top: `${buttonPosition.y}px`,
             transform: 'translateX(-50%)',
           }}
         >
           <Button
             size="sm"
             className="shadow-lg gap-1 h-8"
             onClick={handleAddExpression}
           >
             <Plus className="w-3 h-3" />
             Save expression
           </Button>
         </div>
       )}
 
       {/* Add expression dialog */}
       <AddExpressionDialog
         open={dialogOpen}
         onOpenChange={handleDialogClose}
         initialExpression={selectedText}
         exampleSentence={fullSentence}
         diaryEntryId={diaryEntryId}
         onSaved={onExpressionSaved}
       />
     </div>
   );
 }