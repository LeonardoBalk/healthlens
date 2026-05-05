export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      datasets: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          stats_json: Json | null
          row_count: number | null
          column_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          stats_json?: Json | null
          row_count?: number | null
          column_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          stats_json?: Json | null
          row_count?: number | null
          column_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_points: {
        Row: {
          id: string
          dataset_id: string
          timestamp: string | null
          values_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          dataset_id: string
          timestamp?: string | null
          values_json: Json
          created_at?: string
        }
        Update: {
          id?: string
          dataset_id?: string
          timestamp?: string | null
          values_json?: Json
          created_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          dataset_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          dataset_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          dataset_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
