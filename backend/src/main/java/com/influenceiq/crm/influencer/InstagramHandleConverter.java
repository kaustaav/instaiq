package com.influenceiq.crm.influencer;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Tells JPA how to store an InstagramHandle: as its plain text value in the "handle" column.
 * autoApply = every InstagramHandle field in every entity uses this converter automatically.
 */
@Converter(autoApply = true)
public class InstagramHandleConverter implements AttributeConverter<InstagramHandle, String> {

    @Override
    public String convertToDatabaseColumn(InstagramHandle handle) {
        return handle == null ? null : handle.value();
    }

    @Override
    public InstagramHandle convertToEntityAttribute(String column) {
        return column == null ? null : new InstagramHandle(column);
    }
}
