from typing import TypedDict, Annotated, List, Dict, Any, Optional
import operator


class LegalResearchState(TypedDict):
    query: str
    user_id: str
    filters: Dict[str, Any]
    routing_decision: Dict[str, Any]
    statute_result: Optional[Dict[str, Any]]
    constitutional_result: Optional[Dict[str, Any]]
    case_law_result: Optional[Dict[str, Any]]
    comparison_result: Optional[Dict[str, Any]]
    retrieved_chunks: Annotated[List[Dict[str, Any]], operator.add]
    agent_trace: Annotated[List[Dict[str, Any]], operator.add]
    final_answer: str
    sources: List[Dict[str, Any]]
    confidence: str
    disclaimer: str
