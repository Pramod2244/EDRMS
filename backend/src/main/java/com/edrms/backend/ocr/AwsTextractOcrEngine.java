package com.edrms.backend.ocr;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.textract.TextractClient;
import software.amazon.awssdk.services.textract.TextractClientBuilder;
import software.amazon.awssdk.services.textract.model.*;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Component
public class AwsTextractOcrEngine implements OcrEngine {

    private final TextractClient textractClient;

    private final boolean hasAwsCredentials;

    public AwsTextractOcrEngine(
        @Value("${edrms.ocr.aws.region:us-east-1}") String regionStr,
        @Value("${edrms.ocr.aws.access-key:}") String accessKey,
        @Value("${edrms.ocr.aws.secret-key:}") String secretKey
    ) {
        this.hasAwsCredentials = accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank();
        TextractClient client = null;
        try {
            TextractClientBuilder builder = TextractClient.builder().region(Region.of(regionStr));
            if (this.hasAwsCredentials) {
                builder.credentialsProvider(StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKey, secretKey)
                ));
            }
            client = builder.build();
        } catch (Exception ignored) {
            // Permits graceful startup in dev environments
        }
        this.textractClient = client;
    }

    @Override
    public OcrResult process(InputStream documentStream) {
        if (!isAvailable()) {
            // Graceful fallback / simulation when AWS credentials are not configured in local dev
            return OcrResult.builder()
                .engineType(OcrEngineType.MOCK)
                .totalPages(1)
                .pages(List.of(OcrPageData.builder()
                    .pageNumber(1)
                    .textContent("Mock OCR Text Extracted")
                    .confidence(99.0)
                    .width(1000)
                    .height(1400)
                    .build()))
                .build();
        }

        try {
            byte[] bytes = documentStream.readAllBytes();
            DetectDocumentTextRequest req = DetectDocumentTextRequest.builder()
                .document(Document.builder().bytes(SdkBytes.fromByteArray(bytes)).build())
                .build();

            DetectDocumentTextResponse response = textractClient.detectDocumentText(req);
            StringBuilder textBuilder = new StringBuilder();
            for (Block block : response.blocks()) {
                if (block.blockType() == BlockType.LINE) {
                    textBuilder.append(block.text()).append("\n");
                }
            }

            OcrPageData pageData = OcrPageData.builder()
                .pageNumber(1)
                .textContent(textBuilder.toString())
                .confidence(95.0)
                .build();

            return OcrResult.builder()
                .engineType(OcrEngineType.AWS_TEXTRACT)
                .totalPages(1)
                .pages(List.of(pageData))
                .build();
        } catch (Exception e) {
            // Gracefully fallback instead of failing document upload pipeline
            return OcrResult.builder()
                .engineType(OcrEngineType.MOCK)
                .totalPages(1)
                .pages(List.of(OcrPageData.builder()
                    .pageNumber(1)
                    .textContent("")
                    .confidence(0.0)
                    .width(1000)
                    .height(1400)
                    .build()))
                .build();
        }
    }

    @Override
    public OcrEngineType getEngineType() {
        return OcrEngineType.AWS_TEXTRACT;
    }

    @Override
    public boolean isAvailable() {
        return this.textractClient != null && this.hasAwsCredentials;
    }
}
