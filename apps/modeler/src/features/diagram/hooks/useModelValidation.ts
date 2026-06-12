import { useMemo } from 'react';
import { useModelStore } from '../../../store/model.store';
import { validateModel } from '../utils/validateModel';

interface ModelValidationResult {
  errorCount: number;
  errors: string[];
  warningCount: number;
  warnings: string[];
}

export function useModelValidation(): ModelValidationResult {
  const model = useModelStore((s) => s.model);

  return useMemo(() => {
    const { errors, warnings } = validateModel(model);
    return {
      errorCount: errors.length,
      errors,
      warningCount: warnings.length,
      warnings,
    };
  }, [model]);
}
