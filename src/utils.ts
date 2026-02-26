/**
 * Utility methods static class.
 * Provides generic helper functions.
 */
export class Utils {
  /**
   * Checks if a value is an object (excluding arrays and null by default).
   *
   * @param value - Value to check
   * @param params - Optional configuration parameters
   * @returns Type guard that validates if the value is an Object
   */
  private static isObject(
    value: unknown,
    params?: {
      acceptNull?: boolean;
      acceptArray?: boolean;
      acceptEmpty?: boolean;
    },
  ): value is object {
    const acceptNull = params?.acceptNull === true;
    const acceptArray = params?.acceptArray === true;
    const acceptEmpty = params?.acceptEmpty !== false;

    // Check if it is of type object
    if (typeof value !== 'object') {
      return false;
    }

    // Reject null if not configured to accept
    if (!acceptNull && value === null) {
      return false;
    }

    // Reject arrays if not configured to accept
    if (!acceptArray && Array.isArray(value)) {
      return false;
    }

    // Reject empty objects if not configured to accept
    if (!acceptEmpty && Object.keys(value as object).length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Recursively applies trim to a value.
   *
   * If the value is a string, applies the native trim method.
   * If it is an array or object, iterates recursively applying trim
   * to all internal values. For other types, returns the value unchanged.
   *
   * @param value - Value to trim (string, object, array or other type)
   * @returns Value with trim applied recursively
   *
   * @example
   * ```typescript
   * // String
   * Utils.trim('  hello  ')  // 'hello'
   *
   * // Object
   * Utils.trim({
   *   name: '  John  ',
   *   age: 30,
   * })
   * // { name: 'John', age: 30 }
   * ```
   */
  static trim(value: unknown): unknown {
    // If it is a string, apply native trim
    if (typeof value === 'string') {
      return value.trim();
    }

    // If it is an array, map recursively
    if (Array.isArray(value)) {
      return value.map((item) => this.trim(item));
    }

    // If it is an object (excluding null), iterate through the keys
    if (this.isObject(value)) {
      const trimmed: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        trimmed[key] = this.trim(val);
      }
      return trimmed;
    }

    // For other types (number, boolean, null, undefined), return unchanged
    return value;
  }
}
