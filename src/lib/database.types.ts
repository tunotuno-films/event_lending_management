export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: number
          user_id: string
          name: string
          department: string
          phone_number: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          name?: string
          department?: string
          phone_number?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          name?: string
          department?: string
          phone_number?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
