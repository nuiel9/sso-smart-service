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
  const supabase = await createClient()

  // Generate embedding for the query using Typhoon
  const embedding = await generateEmbedding(query)

  // Search for similar documents using pgvector
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
  })

  if (error) {
    console.error('Error searching documents:', error)
    return []
  }

  return (data as Document[]) || []
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Use Typhoon embedding API
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
  })

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function getRelevantContext(query: string): Promise<string> {
  const documents = await searchDocuments(query)

  if (documents.length === 0) {
    return ''
  }

  return documents
    .map((doc) => doc.content)
    .join('\n\n---\n\n')
}
