package com.edrms.backend.search;

import org.apache.http.HttpHost;
import org.opensearch.client.RestClient;
import org.opensearch.client.json.jackson.JacksonJsonpMapper;
import org.opensearch.client.opensearch.OpenSearchClient;
import org.opensearch.client.transport.OpenSearchTransport;
import org.opensearch.client.transport.rest_client.RestClientTransport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenSearchConfig {

    @Value("${edrms.opensearch.host:localhost}")
    private String host;

    @Value("${edrms.opensearch.port:9200}")
    private int port;

    @Value("${edrms.opensearch.scheme:http}")
    private String scheme;

    @Bean(destroyMethod = "close")
    public RestClient restClient() {
        return RestClient.builder(new HttpHost(host, port, scheme)).build();
    }

    @Bean
    public OpenSearchClient openSearchClient(RestClient restClient) {
        OpenSearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
        return new OpenSearchClient(transport);
    }
}
