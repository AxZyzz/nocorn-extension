// Supabase client library for browser extensions
// This is a simplified version that works with ES6 modules in extensions

class SupabaseClient {
  constructor(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
    this.auth = new SupabaseAuth(this);
    this.currentUser = null;
    this.authListeners = [];
  }

  async request(endpoint, options = {}) {
    // Check if we're in a service worker context
    if (typeof importScripts === 'function') {
      throw new Error('Supabase operations not supported in service worker context');
    }

    const url = `${this.supabaseUrl}/rest/v1${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      ...options.headers
    };

    if (this.currentUser?.access_token) {
      headers.Authorization = `Bearer ${this.currentUser.access_token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  from(table) {
    return new SupabaseQueryBuilder(this, table);
  }
}

class SupabaseAuth {
  constructor(client) {
    this.client = client;
  }

  async signUp({ email, password, options = {} }) {
    try {
      const response = await fetch(`${this.client.supabaseUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.client.supabaseKey
        },
        body: JSON.stringify({
          email,
          password,
          data: options.data || {}
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('Signup API error:', result);
        return { data: { user: null, session: null }, error: result };
      }

      if (result.user) {
        this.client.currentUser = result.user;
        this.client.authListeners.forEach(listener => listener('SIGNED_IN', result.user));
      }

      return { data: result, error: null };
    } catch (error) {
      console.error('Signup request failed:', error);
      return { data: { user: null, session: null }, error: { message: error.message } };
    }
  }

  async signInWithPassword({ email, password }) {
    const response = await fetch(`${this.client.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.client.supabaseKey
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { data: { user: null, session: null }, error: result };
    }

    if (result.user) {
      this.client.currentUser = result.user;
      this.client.authListeners.forEach(listener => listener('SIGNED_IN', result.user));
    }

    return { data: result, error: null };
  }

  async signOut() {
    try {
      if (this.client.currentUser?.access_token) {
        await fetch(`${this.client.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.client.supabaseKey,
            'Authorization': `Bearer ${this.client.currentUser.access_token}`
          }
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    this.client.currentUser = null;
    this.client.authListeners.forEach(listener => listener('SIGNED_OUT', null));
    return { error: null };
  }

  async getUser() {
    if (!this.client.currentUser?.access_token) {
      return { data: { user: null }, error: null };
    }

    try {
      const response = await fetch(`${this.client.supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': this.client.supabaseKey,
          'Authorization': `Bearer ${this.client.currentUser.access_token}`
        }
      });

      if (!response.ok) {
        return { data: { user: null }, error: { message: 'Failed to get user' } };
      }

      const user = await response.json();
      return { data: { user }, error: null };
    } catch (error) {
      return { data: { user: null }, error };
    }
  }

  async getSession() {
    if (!this.client.currentUser?.access_token) {
      return { data: { session: null }, error: null };
    }

    try {
      const response = await fetch(`${this.client.supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': this.client.supabaseKey,
          'Authorization': `Bearer ${this.client.currentUser.access_token}`
        }
      });

      if (!response.ok) {
        return { data: { session: null }, error: { message: 'Failed to get session' } };
      }

      const user = await response.json();
      const session = {
        user: user,
        access_token: this.client.currentUser.access_token
      };
      
      return { data: { session }, error: null };
    } catch (error) {
      return { data: { session: null }, error };
    }
  }

  async resetPasswordForEmail(email, options = {}) {
    try {
      const response = await fetch(`${this.client.supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.client.supabaseKey
        },
        body: JSON.stringify({
          email,
          ...options
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        return { error: result };
      }

      return { error: null };
    } catch (error) {
      return { error: { message: error.message } };
    }
  }

  onAuthStateChange(callback) {
    this.client.authListeners.push(callback);
    return () => {
      const index = this.client.authListeners.indexOf(callback);
      if (index > -1) {
        this.client.authListeners.splice(index, 1);
      }
    };
  }
}

class SupabaseQueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.queryParams = new URLSearchParams();
    this.selectFields = '*';
    this.isSingle = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(column, value) {
    this.queryParams.append(column, `eq.${value}`);
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  insert(data) {
    const self = this;
    return {
      select: (fields = '*') => {
        return {
          single: () => {
            return new Promise(async (resolve) => {
              try {
                const result = await self.client.request(`/${self.table}`, {
                  method: 'POST',
                  body: JSON.stringify(data),
                  headers: {
                    'Prefer': 'return=representation'
                  }
                });
                resolve({ data: Array.isArray(result) ? result[0] : result, error: null });
              } catch (error) {
                resolve({ data: null, error });
              }
            });
          }
        };
      }
    };
  }

  update(data) {
    return {
      eq: (column, value) => {
        this.queryParams.append(column, `eq.${value}`);
        return {
          execute: async () => {
            const query = this.queryParams.toString();
            return this.client.request(`/${this.table}?${query}`, {
              method: 'PATCH',
              body: JSON.stringify(data)
            });
          }
        };
      }
    };
  }

  async execute() {
    let query = `select=${this.selectFields}`;
    if (this.queryParams.toString()) {
      query += `&${this.queryParams.toString()}`;
    }
    
    try {
      const result = await this.client.request(`/${this.table}?${query}`);
      
      if (this.isSingle) {
        if (result.length === 0) {
          return { 
            data: null, 
            error: { code: 'PGRST116', message: 'No rows found' } 
          };
        }
        return { data: result[0], error: null };
      }
      
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

// Export function to create client
export function createClient(supabaseUrl, supabaseKey) {
  return new SupabaseClient(supabaseUrl, supabaseKey);
}

export default { createClient };
