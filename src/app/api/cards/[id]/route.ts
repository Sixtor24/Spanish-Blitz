// @ts-nocheck
import sql from "../../utils/sql";

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      prompt_es,
      answer_es,
      distractor_1_es,
      distractor_2_es,
      distractor_3_es,
      notes,
      translation_en,
    } = body;

    const rows = await sql`
      UPDATE cards
      SET 
        prompt_es = COALESCE(${prompt_es}, prompt_es),
        answer_es = COALESCE(${answer_es}, answer_es),
        distractor_1_es = COALESCE(${distractor_1_es}, distractor_1_es),
        distractor_2_es = COALESCE(${distractor_2_es}, distractor_2_es),
        distractor_3_es = COALESCE(${distractor_3_es}, distractor_3_es),
        notes = COALESCE(${notes}, notes),
        translation_en = COALESCE(${translation_en}, translation_en),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Card not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error updating card:", error);
    return Response.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await sql`DELETE FROM cards WHERE id = ${id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting card:", error);
    return Response.json({ error: "Failed to delete card" }, { status: 500 });
  }
}
