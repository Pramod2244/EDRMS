package com.edrms.backend.ocr;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ScanTextQualityTest {
    @Test void weightsConfidenceByRecognizedCharactersAndIgnoresNonWords() {
        var result=TesseractOcrEngine.parseScanTsv("level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"
            +"1\t1\t0\t0\t0\t0\t0\t0\t10\t10\t-1\t\n"
            +"5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t90\tHello\n"
            +"5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t20\tXYZ\n");
        assertEquals(8,result.characters()); assertEquals(63.75,result.meanConfidence()); assertEquals(5,result.confidentCharacters());
    }
    @Test void emptyOrMalformedOutputCannotPass() {
        assertEquals(0,TesseractOcrEngine.parseScanTsv("header\n5\tbad").characters());
    }
}
