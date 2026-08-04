# Fonte de dados do framework

`Dock_Trust_Framework_Segmentado.xlsx` é a planilha oficial de onde o
framework v3 é gerado. Para regenerar `src/seed/data/*.json` depois de uma
edição na planilha:

```bash
python3 ../scripts/xlsx_to_framework.py Dock_Trust_Framework_Segmentado.xlsx ../src/seed/data
```

Substitua este arquivo pela versão mais recente sempre que o time de
produto atualizar o banco de perguntas — é ele que deve ficar versionado
junto do código, não uma cópia solta em algum drive.
