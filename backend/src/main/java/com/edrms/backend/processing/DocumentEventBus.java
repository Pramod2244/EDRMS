package com.edrms.backend.processing;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class DocumentEventBus {

    private final ApplicationEventPublisher eventPublisher;

    public DocumentEventBus(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    public void publish(DocumentIngestedEvent event) {
        // Publishes asynchronously to Spring application event listeners
        // Can be replaced with Redis Streams / RabbitMQ / SQS adapter seamlessly
        eventPublisher.publishEvent(event);
    }
}
