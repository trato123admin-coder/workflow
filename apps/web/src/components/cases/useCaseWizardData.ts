import { useState, useEffect } from 'react';
import { createClient } from '../../lib/supabase/client';

export interface WizardModelOption {
  version_id: string;
  code: string;
  name: string;
  version: number;
}

export interface WizardUserOption {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useCaseWizardData(isOpen: boolean) {
  const [models, setModels] = useState<WizardModelOption[]>([]);
  const [selectedModelVersionId, setSelectedModelVersionId] = useState('');
  const [users, setUsers] = useState<WizardUserOption[]>([]);
  const [responsibleId, setResponsibleId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const supabase = createClient();
        const { data: vData } = await supabase
          .from('case_model_versions')
          .select(`id, version, case_models ( code, name )`)
          .eq('status', 'PUBLISHED');

        if (vData) {
          const formatted = (
            vData as unknown as {
              id: string;
              version: number;
              case_models: { code: string; name: string } | null;
            }[]
          ).map((v) => ({
            version_id: v.id,
            code: v.case_models?.code || '',
            name: v.case_models?.name || '',
            version: v.version,
          }));
          setModels(formatted);
          const notarial =
            formatted.find((m) => m.code === 'SUCESION_INTESTADA_NOTARIAL') || formatted[0];
          if (notarial) setSelectedModelVersionId(notarial.version_id);
        }

        const { data: uData } = await supabase
          .from('profiles')
          .select(`id, email, first_name, last_name, user_roles!user_id ( roles ( code, name ) )`)
          .eq('is_active', true);

        if (uData) {
          const formattedUsers = (
            uData as unknown as {
              id: string;
              email: string;
              first_name: string | null;
              last_name: string | null;
              user_roles: { roles: { code: string; name: string } | null }[] | null;
            }[]
          ).map((u) => ({
            id: u.id,
            email: u.email,
            name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
            role: u.user_roles?.[0]?.roles?.name || 'Usuario',
          }));
          setUsers(formattedUsers);

          const { data: sessionData } = await supabase.auth.getSession();
          const currentUserId = sessionData.session?.user?.id;
          if (currentUserId) {
            setResponsibleId(currentUserId);
          } else if (formattedUsers.length > 0 && formattedUsers[0]) {
            setResponsibleId(formattedUsers[0].id);
          }
        }
      } catch (err) {
        // Fallback
      }
    };

    loadData();
  }, [isOpen]);

  return {
    models,
    selectedModelVersionId,
    setSelectedModelVersionId,
    users,
    responsibleId,
    setResponsibleId,
  };
}
