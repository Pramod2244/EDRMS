package com.edrms.backend.configuration;
import com.edrms.backend.roles.RoleCatalogService;
import com.edrms.backend.users.User;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ApplicationSettingsServiceTest {
    final ConfigurationRepository repository=mock(ConfigurationRepository.class);
    final RoleCatalogService access=mock(RoleCatalogService.class);
    final ApplicationSettingsService service=new ApplicationSettingsService(repository,access);
    @Test void defaultsToThirtyDays(){assertEquals(30,service.retentionDays());}
    @Test void validatesWholeNumberRange(){var definition=new ApplicationSettingsService.Definition("DAYS","Days",ApplicationSettingsService.Type.NUMBER,"30",1,3650,"");assertEquals("30",ApplicationSettingsService.validate(definition,"30"));for(String value:new String[]{"0","-1","3651","1.5","true","","999999999999"})assertThrows(IllegalArgumentException.class,()->ApplicationSettingsService.validate(definition,value));}
    @Test void supportsStrictBooleanDefinitions(){var definition=new ApplicationSettingsService.Definition("FLAG","Flag",ApplicationSettingsService.Type.BOOLEAN,"false",0,0,"");assertEquals("true",ApplicationSettingsService.validate(definition,"true"));assertEquals("false",ApplicationSettingsService.validate(definition,"false"));assertThrows(IllegalArgumentException.class,()->ApplicationSettingsService.validate(definition,"yes"));}
    @Test void nonAdministratorCannotChangeSettings(){when(access.requireUser()).thenReturn(User.builder().role("CONTRIBUTOR").build());assertThrows(SecurityException.class,()->service.save("RECYCLE_BIN_DAYS","7"));verifyNoInteractions(repository);}
    @Test void unknownSettingsCannotBeAddedByClients(){when(access.requireUser()).thenReturn(User.builder().role("SUPER_ADMIN").build());assertThrows(IllegalArgumentException.class,()->service.save("UPLOAD_BLOCKED","true"));verifyNoInteractions(repository);}
}
