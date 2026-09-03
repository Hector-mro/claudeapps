-- « Un tap coche » : sur un téléphone tenu d'une main dans un couloir, le
-- geste part parfois tout seul. Sans retour arrière, cocher par erreur
-- « Courses de la semaine » repousse la tâche de sept jours sans aucun moyen
-- de la ramener depuis l'interface.
--
-- On mémorise donc l'échéance d'avant sur la ligne de completion : annuler
-- redevient une opération exacte, et non une estimation.
-- NULL sur les lignes existantes : leur annulation est refusée.
ALTER TABLE completions ADD COLUMN previous_next_due_on TEXT;
