#include <stdio.h>

#define BUF_LEN 128

char line[BUF_LEN];

int get_line(FILE *fp) {
	int i = 0, c;
	
	while (i < BUF_LEN-1) {
		if ((c = fgetc(fp))!= EOF) {
			if (c == '\n')
				break;
				
			line[i++] = c;
		}
	}
	
	line[i] = '\0';
	return i;
}

void put_line(FILE *fp, int j) {
	int i = 0;
	
	while (i < j) {
		fputc(line[i++], fp);
	}
	fputc('\n', fp);
	fflush(fp);
}

int main( int argc, char *args[]) {
	char *in = "ecg.csv";
	char *out = "ecg2.csv";
	FILE *fin = fopen(in, "r");
	
	if (!fin) {
		fprintf(stderr, "Couldn't open %s\n", in);
		return 1;
	}
	
	fprintf(stderr, "Opened %s\n", in);
	
	FILE *fout = fopen(out, "w");
	
	if (!fout) {
		fprintf(stderr, "Couldn't open %s\n", out);
		return 1;
	}
	
	fprintf(stderr, "Opened %s\n", out);
	
	
	int i = 0, j = 0;
	
	while (!feof(fin) && (i = get_line(fin))) {
		if (++j == 50) {
			fprintf(stderr, "line length %d\n", i);
			put_line(fout, i);
			j = 0;
		}
		
		++i;
	}
	
	fflush(fout);
	fclose(fout);
	fclose(fin);
	return 0;
}