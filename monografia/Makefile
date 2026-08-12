JOBNAME	= monografia
LATEX		= pdflatex
BIBTEX	 = bibtex
FLAGS		= -interaction=nonstopmode -halt-on-error

.PHONY: all clean distclean FORCE

all: $(JOBNAME).pdf

# Full build: tex → bibtex → tex → tex
# FORCE makes make always rebuild regardless of timestamps
$(JOBNAME).pdf: $(JOBNAME).tex $(JOBNAME).bib FORCE
	$(LATEX) $(FLAGS) $(JOBNAME)
	$(BIBTEX) $(JOBNAME)
	$(LATEX) $(FLAGS) $(JOBNAME)
	$(LATEX) $(FLAGS) $(JOBNAME)

clean:
	rm -f $(JOBNAME).aux \
		$(JOBNAME).bbl \
		$(JOBNAME).blg \
		$(JOBNAME).log \
		$(JOBNAME).out \
		$(JOBNAME).toc \
		$(JOBNAME).lof \
		$(JOBNAME).lot \
		$(JOBNAME).lol \
		$(JOBNAME).fdb_latexmk \
		$(JOBNAME).synctex.gz

distclean: clean
	rm -f $(JOBNAME).pdf

