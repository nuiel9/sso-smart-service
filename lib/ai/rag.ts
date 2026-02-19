import { createClient } from '@/lib/supabase/server'

interface Document {
  id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export async function searchDocuments(
  query: string,
  limit: number = 5
): Promise<Document[]> {
  try {
    const embedding = await generateEmbedding(query)
    if (!embedding) return []

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    })

    if (error) {
      console.error('RAG search error:', error)
      return []
    }

    return (data as Document[]) || []
  } catch (err) {
    console.error('searchDocuments unexpected error:', err)
    return []
  }
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.opentyphoon.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TYPHOON_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'typhoon-v2-embed',
        input: text,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      console.error(`Embedding API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.data[0].embedding as number[]
  } catch (err) {
    console.error('generateEmbedding error:', err)
    return null
  }
}

export async function getRelevantContext(query: string): Promise<string> {
  try {
    const documents = await searchDocuments(query)
    if (documents.length === 0) return ''
    return documents.map((doc) => doc.content).join('\n\n---\n\n')
  } catch {
    return ''
  }
}
