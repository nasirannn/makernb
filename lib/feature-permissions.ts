import { query } from './db-query-builder';

// ============================================================================
// TIER CODE MAPPING (Deprecated - kept for backward compatibility)
// ============================================================================

/**
 * 将订阅 plan_id 映射到 tier_code
 * monthly_basic / yearly_basic → basic
 * monthly_premium / yearly_premium → premium
 * 无订阅 → basic (默认)
 * 
 * @deprecated 使用 getUserTierCode() 直接通过 tier_id 查询，此函数仅用于向后兼容
 */
export const getTierCodeFromPlanId = (planId: string | null): 'basic' | 'premium' => {
  if (!planId) return 'basic';
  
  if (planId.includes('premium')) {
    return 'premium';
  }
  
  return 'basic';
};

/**
 * 获取用户的订阅层级 ID
 * 直接查询 user_subscriptions.tier_id
 * 如果没有活跃订阅，返回 null（用户将没有任何功能权限）
 */
export const getUserTierId = async (userId: string): Promise<string | null> => {
  try {
    // 直接查询 tier_id，避免额外的 JOIN 操作
    const result = await query(
      `SELECT tier_id
       FROM user_subscriptions
       WHERE user_id = $1::uuid 
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0 && result.rows[0].tier_id) {
      return result.rows[0].tier_id;
    }

    // 如果没有活跃订阅，返回 null
    // 这样用户将没有任何功能权限，需要通过订阅才能获得权限
    return null;
  } catch (error) {
    console.error('[FEATURE-PERMISSIONS] Error getting user tier id:', error);
    return null;
  }
};

/**
 * 获取用户的订阅层级代码
 * 通过 user_subscriptions.tier_id 直接关联 subscription_tiers 表
 * 如果没有活跃订阅，默认返回 'basic'
 * 
 * @deprecated 如果只需要检查权限，优先使用 getUserTierId() + 直接查询 tier_features
 */
export const getUserTierCode = async (userId: string): Promise<'basic' | 'premium'> => {
  try {
    // 直接通过 tier_id 关联查询，避免字符串映射
    const result = await query(
      `SELECT st.code as tier_code
       FROM user_subscriptions us
       INNER JOIN subscription_tiers st ON us.tier_id = st.id
       WHERE us.user_id = $1::uuid 
       AND us.status = 'active'
       ORDER BY us.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].tier_code as 'basic' | 'premium';
    }

    // 默认返回 basic（没有活跃订阅时）
    return 'basic';
  } catch (error) {
    console.error('[FEATURE-PERMISSIONS] Error getting user tier code:', error);
    // 出错时返回 basic，确保用户可以访问基本功能
    return 'basic';
  }
};

// ============================================================================
// FEATURE PERMISSION CHECKING
// ============================================================================

/**
 * 检查用户是否有某个功能的权限
 * 直接使用 tier_id 查询，避免不必要的 JOIN 操作
 */
export const hasFeaturePermission = async (
  userId: string,
  featureCode: string
): Promise<boolean> => {
  try {
    // 获取用户的 tier_id
    const tierId = await getUserTierId(userId);
    
    if (!tierId) {
      return false;
    }

    // 直接使用 tier_id 查询功能权限，减少一次 JOIN
    const result = await query(
      `SELECT tf.id 
       FROM tier_features tf
       INNER JOIN features f ON tf.feature_id = f.id
       WHERE f.code = $1 
       AND tf.tier_id = $2::uuid
       AND tf.is_enabled = TRUE`,
      [featureCode, tierId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error(`[FEATURE-PERMISSIONS] Error checking feature permission for ${featureCode}:`, error);
    // 出错时返回 false，确保安全
    return false;
  }
};

/**
 * 批量检查用户的多个功能权限
 * 直接使用 tier_id 查询，避免不必要的 JOIN 操作
 */
export const batchCheckFeaturePermissions = async (
  userId: string,
  featureCodes: string[]
): Promise<Record<string, boolean>> => {
  if (featureCodes.length === 0) return {};

  try {
    // 获取用户的 tier_id
    const tierId = await getUserTierId(userId);
    
    if (!tierId) {
      // 如果没有 tier_id，返回全部 false
      const permissions: Record<string, boolean> = {};
      featureCodes.forEach(code => {
        permissions[code] = false;
      });
      return permissions;
    }

    // 直接使用 tier_id 批量查询功能权限，减少一次 JOIN
    const result = await query(
      `SELECT f.code as feature_code
       FROM tier_features tf
       INNER JOIN features f ON tf.feature_id = f.id
       WHERE f.code = ANY($1)
       AND tf.tier_id = $2::uuid
       AND tf.is_enabled = TRUE`,
      [featureCodes, tierId]
    );

    const allowedFeatures = new Set(result.rows.map(row => row.feature_code));

    // 返回所有功能的权限映射
    const permissions: Record<string, boolean> = {};
    featureCodes.forEach(code => {
      permissions[code] = allowedFeatures.has(code);
    });

    return permissions;
  } catch (error) {
    console.error('[FEATURE-PERMISSIONS] Error batch checking feature permissions:', error);
    // 出错时返回全部 false
    const permissions: Record<string, boolean> = {};
    featureCodes.forEach(code => {
      permissions[code] = false;
    });
    return permissions;
  }
};

/**
 * 获取用户所有可用的功能列表
 * 直接使用 tier_id 查询，避免不必要的 JOIN 操作
 */
export const getUserAvailableFeatures = async (userId: string): Promise<string[]> => {
  try {
    // 获取用户的 tier_id
    const tierId = await getUserTierId(userId);
    
    if (!tierId) {
      return [];
    }

    // 直接使用 tier_id 查询该层级的所有可用功能，减少一次 JOIN
    const result = await query(
      `SELECT f.code as feature_code
       FROM tier_features tf
       INNER JOIN features f ON tf.feature_id = f.id
       WHERE tf.tier_id = $1::uuid
       AND tf.is_enabled = TRUE`,
      [tierId]
    );

    return result.rows.map(row => row.feature_code);
  } catch (error) {
    console.error('[FEATURE-PERMISSIONS] Error getting user available features:', error);
    return [];
  }
};

