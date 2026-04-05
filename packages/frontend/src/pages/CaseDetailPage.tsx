import React from 'react';
import { useParams } from 'react-router-dom';
import { CaseWorkspace } from '@/components/cases/CaseWorkspace';

const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <p className="text-base text-gray-400">No case ID provided.</p>;
  }

  return <CaseWorkspace caseId={id} />;
};

export default CaseDetailPage;
