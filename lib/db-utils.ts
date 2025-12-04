// ============================================================================
// SHARED DATABASE UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates required parameters for database operations
 * @param params - Object containing parameters to validate
 * @param requiredFields - Array of field names that must be present
 * @throws Error if any required field is missing
 */
export const validateRequiredParams = (
  params: Record<string, any>,
  requiredFields: string[]
): void => {
  for (const field of requiredFields) {
    if (!params[field]) {
      throw new Error(`Missing required parameter: ${field}`);
    }
  }
};

/**
 * Builds dynamic UPDATE SQL clause from data object
 * @param data - Object containing fields to update
 * @param excludeFields - Array of field names to exclude from update
 * @returns Object with setClause string and values array for parameterized query
 */
export const buildUpdateClause = (
  data: Record<string, any>,
  excludeFields: string[] = []
): { setClause: string; values: any[] } => {
  const fields = Object.keys(data).filter((key) => !excludeFields.includes(key));
  const setClause = fields
    .map((field, index) => `${field} = $${index + 2}`)
    .join(', ');
  const values = fields.map((field) => data[field]);

  return { setClause, values };
};
