# Canonical exercise identity resolution

## Result

Migration 252 consolidates 83 redundant canonical definitions into surviving
identities. It preserves:

- all 1,673 legacy source IDs through `exercise_definition_source_v1`;
- all 1,673 source variants and their difficulty, equipment, load, and fatigue
  data;
- all 1,717 contextual delivery profiles;
- provenance and an explicit resolution record for every consolidation.

The resulting library contains 1,590 active canonical definitions and zero
direct canonical-name, display-name, or alias collisions. Consolidated source
definitions are archived and remain traceable; they are not deleted.

## Similar names that remain distinct

The remaining 36 high-similarity pairs are warnings, not identity collisions.
They contain movement-changing qualifiers and must not be silently combined:

- start versus sprint-start; call-out versus cut; turn versus open turn;
- rebound versus pogo or broad rebound;
- bear-plank versus balance, and free movement versus ladder or box;
- two-point versus three-point starts;
- floor versus box, single versus double, and regular versus bottoms-up loading;
- lateral, rotational, forward/backward, inversion, and eversion directions;
- generic kneeling, tall-kneeling, and half-kneeling positions;
- line, low-line, on-cue, split-stance, triple-hop, and wall-target constraints;
- overhead versus overhead-back projection;
- squat-clean versus wall-ball-shot completion;
- press, push press, Z-press, arc press, press-out, deadlift-to-row, and
  180-degree rotation;
- countermovement versus non-countermovement;
- depth drop, depth jump, box jump, and their different execution order.

The final name-similarity pair at score 100 is “Depth Drop to Box Jump” versus
“Box Jump to Depth Drop.” The old bigram score ignored word order. Exact
collision detection now compares normalized identities directly, so this
meaningful order difference no longer blocks either card.

## Governance

Deterministic consolidation never grants publication approval. Every surviving
card remains in review and retains its media, content, relationship, calibration,
and two-person approval gates. A future coach may decide to model one of the
remaining similar pairs as variants of one definition, but that is a card-content
revision—not an unresolved identity collision.
