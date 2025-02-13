import Index from '../@types/IndexType'
import Lexeme from '../@types/Lexeme'
import Thought from '../@types/Thought'
import ThoughtId from '../@types/ThoughtId'
import ThoughtWithChildren from '../@types/ThoughtWithChildren'

/** A standard interface for data providers that can sync thoughts. See data-providers/README.md. */
export interface DataProvider {
  name?: string
  clearAll: () => Promise<unknown>
  getLexemeById: (id: string) => Promise<Lexeme | undefined>
  getLexemesByIds: (ids: string[]) => Promise<(Lexeme | undefined)[]>
  getThoughtById: (id: ThoughtId) => Promise<Thought | undefined>
  getThoughtsByIds: (ids: ThoughtId[]) => Promise<(Thought | undefined)[]>
  getThoughtWithChildren: (id: ThoughtId) => Promise<ThoughtWithChildren | undefined>
  update?: (updates: Index<any>) => Promise<unknown>
  updateThoughts?: (
    thoughtIndexUpdates: Index<ThoughtWithChildren | null>,
    lexemeIndexUpdates: Index<Lexeme | null>,
    schemaVersion: number,
  ) => Promise<unknown>

  // testing only
  updateLexeme: (id: string, thought: Lexeme) => Promise<unknown>
  updateThought: (
    id: ThoughtId,
    thoughtOld: ThoughtWithChildren | undefined,
    thoughtWithChildren: ThoughtWithChildren,
  ) => Promise<unknown>
  updateLexemeIndex: (lexemeIndex: Index<Lexeme>) => Promise<unknown>
  updateThoughtIndex: (thoughtIndex: Index<ThoughtWithChildren>) => Promise<unknown>
}
