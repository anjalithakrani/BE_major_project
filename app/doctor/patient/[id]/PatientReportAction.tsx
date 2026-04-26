'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  patientName: string;
  stats: any;
}

export default function PatientReportAction({ patientName, stats }: Props) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      setGenerating(true);
      // These imports only happen in the browser when the user clicks
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 138);
      doc.text("Therapy Progress Report", 14, 22);
      
      autoTable(doc, {
        startY: 35,
        head: [['Metric', 'Status']],
        body: [
          ['Patient Name', patientName],
          ['Total Sessions', stats.total.toString()],
          ['Completion Rate', `${stats.rate}%`],
          ['Avg Accuracy', `${stats.accuracy}%`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 58, 138] }
      });

      doc.save(`Report_${patientName.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button 
      onClick={handleDownload} 
      disabled={generating} 
      variant="outline" 
      className="gap-2 border-blue-200 text-blue-700"
    >
      {generating ? <Spinner className="w-4 h-4" /> : <FileText className="w-4 h-4 text-blue-600"/>}
      {generating ? "Preparing PDF..." : "Quick PDF"}
    </Button>
  );
}