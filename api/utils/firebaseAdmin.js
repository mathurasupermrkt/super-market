/**
 * Mathura QuickMart — Backend Firestore REST Helper for Serverless Functions
 * Provides lightweight read/write access to Cloud Firestore documents without heavy binary dependencies.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'mathura-quickmart-v2';

/**
 * Encodes a JavaScript object into Firestore REST JSON format
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Decodes Firestore REST response JSON into standard JavaScript object
 */
function fromFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) res[k] = v.stringValue;
    else if ('booleanValue' in v) res[k] = v.booleanValue;
    else if ('integerValue' in v) res[k] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) res[k] = parseFloat(v.doubleValue);
    else if ('nullValue' in v) res[k] = null;
    else if ('mapValue' in v) res[k] = fromFirestoreFields(v.mapValue.fields);
    else if ('arrayValue' in v) res[k] = (v.arrayValue.values || []).map(item => {
      if ('stringValue' in item) return item.stringValue;
      if ('booleanValue' in item) return item.booleanValue;
      if ('integerValue' in item) return parseInt(item.integerValue, 10);
      if ('doubleValue' in item) return parseFloat(item.doubleValue);
      return item;
    });
    else res[k] = v;
  }
  return res;
}

/**
 * Gets a Firestore document
 */
export async function getFirestoreDoc(collection, docId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Firestore GET failed: ${res.statusText}`);
    }
    const data = await res.json();
    return {
      id: docId,
      ...fromFirestoreFields(data.fields)
    };
  } catch (err) {
    console.warn(`[Firestore REST] Error getting doc ${collection}/${docId}:`, err.message);
    return null;
  }
}

/**
 * Sets or updates a Firestore document
 */
export async function setFirestoreDoc(collection, docId, data, merge = true) {
  try {
    const fields = {};
    const updateMasks = [];
    for (const [k, v] of Object.entries(data)) {
      fields[k] = toFirestoreValue(v);
      updateMasks.push(`updateMask.fieldPaths=${encodeURIComponent(k)}`);
    }

    let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
    if (merge && updateMasks.length > 0) {
      url += `?${updateMasks.join('&')}`;
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[Firestore REST] Write status ${res.status}:`, errBody);
      return { success: false, error: errBody };
    }

    return { success: true };
  } catch (err) {
    console.error(`[Firestore REST Error] Failed to write ${collection}/${docId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Finds document in a collection where a field equals a specific value
 */
export async function findDocByField(collection, fieldName, fieldValue) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: fieldName },
            op: 'EQUAL',
            value: toFirestoreValue(fieldValue)
          }
        },
        limit: 1
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryPayload)
    });

    if (!res.ok) return null;
    const results = await res.json();
    if (Array.isArray(results) && results.length > 0 && results[0].document) {
      const doc = results[0].document;
      const docId = doc.name.split('/').pop();
      return {
        id: docId,
        ...fromFirestoreFields(doc.fields)
      };
    }
    return null;
  } catch (err) {
    console.warn(`[Firestore REST] Query error:`, err.message);
    return null;
  }
}
