-- SQLite Migration Script for Access Data
-- Usage: sqlite3 historical.db < historical_migration.sql

CREATE TABLE IF NOT EXISTS [pjuridicas] (
    [idPJ] INTEGER PRIMARY KEY,
    [Inativo] INTEGER, -- Converted from Boolean (0=False, 1=True)
    [idClienteTipo] INTEGER,
    [Cliente] TEXT,
    [Número] REAL, -- Access Double/Float
    [Complemento] TEXT,
    [N° Unidades] REAL,
    [CEP] TEXT,
    [Telefone] TEXT,
    [Telefone 2] TEXT
);

-- Derived from User Snippet
-- Note: SQLite handles [Brackets] for identifiers natively.
INSERT INTO [pjuridicas] ([idPJ],[Inativo],[idClienteTipo],[Cliente],[Número],[Complemento],[N° Unidades],[CEP],[Telefone],[Telefone 2]) VALUES
	 (1,0,4,'LAS VEGAS, COND.',2372.0,NULL,76.0,'88034102',NULL,NULL),
	 (2,0,1,'JARDINS DO ITACORUBI, COND.',2259.0,NULL,98.0,'88034102',NULL,NULL),
	 (3,0,1,'ALBATROZ, COND.',2170.0,NULL,30.0,'88034102',NULL,NULL),
	 (4,0,1,'OASIS, COND.',2155.0,NULL,156.0,'88034102',NULL,NULL),
	 (5,0,1,'FLORAVILLE, COND.',2108.0,NULL,42.0,'88034102',NULL,NULL),
	 (6,0,1,'CAMINHO DO ENGENHO, COND.',160.0,NULL,72.0,'88034300',NULL,NULL),
	 (7,0,1,'ILHA BELLA, COND.',1940.0,NULL,26.0,'88034102',NULL,NULL),
	 (8,0,1,'JOÃO SEBEM, COND.',1866.0,NULL,48.0,'88034102',NULL,NULL),
	 (9,0,1,'PREMIUM, COND.',1788.0,NULL,48.0,'88034102',NULL,NULL),
	 (10,0,1,'DOLOMOTI, COND.',49.0,NULL,28.0,'88034260',NULL,NULL);
